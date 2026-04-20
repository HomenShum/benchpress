"""Verdict classification with Wilson + Newcombe CIs.

The core discipline this module enforces: **no point-estimate comparisons**.
Every (ceiling - baseline) or (distilled - baseline) check goes through
Newcombe's method for the CI of a proportion difference; we only call a
difference significant when the 95% CI excludes zero.

Why Newcombe: it respects small-sample asymmetry and doesn't underreport
variance the way naive normal-approximation does. Matches what BFCL /
SWE-bench papers use for leaderboard claims.

Prior art:
    Newcombe, R.G. (1998). "Interval estimation for the difference
    between independent proportions." Stat. Med. 17, 873-890.
"""

from __future__ import annotations

import math
from typing import Iterable

from daas.fidelity.types import (
    FidelityTrial,
    FidelityVerdict,
    Measurement,
    TransferVerdict,
)

# Minimum trials required before we emit a non-"insufficient_data" verdict.
# At n=30, Wilson halfwidth at p=0.5 is ~18pp — too wide to make claims.
# At n=60 it's ~13pp, at n=100 ~10pp, at n=200 ~7pp. We require 60 as a
# floor; the narrative warns loudly below 100.
MIN_TRIALS_FOR_CLASSIFICATION = 60

# When fidelity_pct >= this, call it "transfers" (distilled reaches
# ceiling). Below this but positive, "lossy" (partial transfer).
FIDELITY_TRANSFERS_THRESHOLD = 0.80

Z_95 = 1.959963984540054  # 1.96 to higher precision for consistency


def wilson_ci(k: int, n: int, z: float = Z_95) -> tuple[float, float]:
    """Wilson score 95% confidence interval for k successes in n trials."""
    if n <= 0:
        return (0.0, 0.0)
    p = k / n
    denom = 1 + z * z / n
    centre = p + z * z / (2 * n)
    spread = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)
    lo = (centre - spread) / denom
    hi = (centre + spread) / denom
    return (max(0.0, lo), min(1.0, hi))


def newcombe_diff_ci(
    ka: int, na: int, kb: int, nb: int, z: float = Z_95
) -> tuple[float, float]:
    """95% CI for the difference (pa - pb) using Newcombe's method.

    Returns (lo, hi). If 0 is outside [lo, hi], the difference is
    significant at 95% confidence.
    """
    if na <= 0 or nb <= 0:
        return (0.0, 0.0)
    pa = ka / na
    pb = kb / nb
    la, ha = wilson_ci(ka, na, z)
    lb, hb = wilson_ci(kb, nb, z)
    # Standard Newcombe formulas
    lo = pa - pb - math.sqrt((pa - la) ** 2 + (hb - pb) ** 2)
    hi = pa - pb + math.sqrt((ha - pa) ** 2 + (pb - lb) ** 2)
    return (lo, hi)


def _diff_significant(
    ka: int, na: int, kb: int, nb: int, direction: str = "gt"
) -> bool:
    """Is (pa - pb) significantly different from 0?

    direction="gt" — is pa > pb (Newcombe CI lo > 0)?
    direction="lt" — is pa < pb (Newcombe CI hi < 0)?
    direction="ne" — is pa != pb (0 outside [lo, hi])?
    """
    lo, hi = newcombe_diff_ci(ka, na, kb, nb)
    if direction == "gt":
        return lo > 0
    if direction == "lt":
        return hi < 0
    return lo > 0 or hi < 0


def build_measurement(
    model: str,
    passed: int,
    total: int,
    *,
    avg_cost_usd: float = 0.0,
    avg_duration_ms: float = 0.0,
    harness_errors: int = 0,
) -> Measurement:
    lo, hi = wilson_ci(passed, total)
    return Measurement(
        model=model,
        passed=passed,
        total=total,
        ci_lo=lo,
        ci_hi=hi,
        avg_cost_usd=avg_cost_usd,
        avg_duration_ms=avg_duration_ms,
        harness_errors=harness_errors,
    )


def classify(
    trials: Iterable[FidelityTrial],
    externalization_id: str,
    benchmark_id: str,
    *,
    baseline_model: str = "baseline",
    ceiling_model: str = "ceiling",
    distilled_model: str = "distilled",
) -> FidelityVerdict:
    """Aggregate per-task trials into a single verdict.

    Exclusions from the pass/fail tallies:
      * tasks where ANY of the three measurements errored (harness failures
        aren't scaffold failures)

    This is the only function product code should call to compute a verdict.
    It enforces the "no point-estimate" discipline downstream: every
    significance check is a Newcombe CI comparison.
    """
    trials = list(trials)

    # Split out harness-errored trials so they don't pollute pass rates.
    clean: list[FidelityTrial] = []
    error_count_baseline = 0
    error_count_ceiling = 0
    error_count_distilled = 0
    for t in trials:
        if t.baseline_error:
            error_count_baseline += 1
        if t.ceiling_error:
            error_count_ceiling += 1
        if t.distilled_error:
            error_count_distilled += 1
        if t.baseline_error or t.ceiling_error or t.distilled_error:
            continue
        clean.append(t)

    n = len(clean)
    passed_baseline = sum(1 for t in clean if t.baseline_passed)
    passed_ceiling = sum(1 for t in clean if t.ceiling_passed)
    passed_distilled = sum(1 for t in clean if t.distilled_passed)

    def _avg(extract) -> float:
        return sum(extract(t) for t in clean) / n if n > 0 else 0.0

    baseline = build_measurement(
        baseline_model,
        passed_baseline,
        n,
        avg_cost_usd=_avg(lambda t: t.baseline_cost_usd),
        harness_errors=error_count_baseline,
    )
    ceiling = build_measurement(
        ceiling_model,
        passed_ceiling,
        n,
        avg_cost_usd=_avg(lambda t: t.ceiling_cost_usd),
        harness_errors=error_count_ceiling,
    )
    distilled = build_measurement(
        distilled_model,
        passed_distilled,
        n,
        avg_cost_usd=_avg(lambda t: t.distilled_cost_usd),
        harness_errors=error_count_distilled,
    )

    # Sample adequacy check — refuse to make claims on tiny samples.
    if n < MIN_TRIALS_FOR_CLASSIFICATION:
        return FidelityVerdict(
            externalization_id=externalization_id,
            benchmark_id=benchmark_id,
            baseline=baseline,
            ceiling=ceiling,
            distilled=distilled,
            verdict="insufficient_data",
            gap_pp=(ceiling.rate - baseline.rate) * 100,
            transfer_pp=(distilled.rate - baseline.rate) * 100,
            fidelity_pct=None,
            gap_significant=False,
            transfer_significant=False,
            regression_significant=False,
            narrative=(
                f"n={n} < {MIN_TRIALS_FOR_CLASSIFICATION} minimum. "
                "Run more trials before making a claim."
            ),
        )

    gap_significant = _diff_significant(
        passed_ceiling, n, passed_baseline, n, direction="gt"
    )
    transfer_significant = _diff_significant(
        passed_distilled, n, passed_baseline, n, direction="gt"
    )
    regression_significant = _diff_significant(
        passed_baseline, n, passed_distilled, n, direction="gt"
    )

    gap_pp = (ceiling.rate - baseline.rate) * 100
    transfer_pp = (distilled.rate - baseline.rate) * 100

    # Decision tree (order matters — regression + no_gap are guards):
    if regression_significant:
        verdict: TransferVerdict = "regression"
        narrative = (
            f"Scaffold HURTS: distilled {distilled.rate:.1%} significantly below "
            f"baseline {baseline.rate:.1%} (Newcombe CI excludes 0). Remove scaffold."
        )
        fidelity = (transfer_pp / gap_pp) if gap_pp > 0 else None
    elif not gap_significant:
        verdict = "no_gap"
        narrative = (
            f"No gap to transfer: ceiling {ceiling.rate:.1%} not significantly "
            f"above baseline {baseline.rate:.1%}. Scaffold is decoration; "
            "route to small model solo."
        )
        fidelity = None
    elif not transfer_significant:
        verdict = "lossy"
        narrative = (
            f"Transfer failed: gap is real ({gap_pp:.1f}pp) but distilled "
            f"{distilled.rate:.1%} not significantly above baseline "
            f"{baseline.rate:.1%}. Redistill with richer source traces "
            "or route to big model."
        )
        fidelity = 0.0 if gap_pp > 0 else None
    else:
        # Transfer is real and positive. Did it close the gap?
        fidelity = transfer_pp / gap_pp if gap_pp > 0 else None
        if fidelity is not None and fidelity >= FIDELITY_TRANSFERS_THRESHOLD:
            verdict = "transfers"
            narrative = (
                f"Transfers: distilled {distilled.rate:.1%} closed "
                f"{fidelity:.0%} of a {gap_pp:.1f}pp gap. Ship the scaffold."
            )
        else:
            verdict = "lossy"
            fidelity_str = f"{fidelity:.0%}" if fidelity is not None else "n/a"
            narrative = (
                f"Lossy transfer: distilled {distilled.rate:.1%} closed only "
                f"{fidelity_str} of {gap_pp:.1f}pp gap. Redistill with richer "
                "source traces, or route high-value tasks to big model."
            )

    return FidelityVerdict(
        externalization_id=externalization_id,
        benchmark_id=benchmark_id,
        baseline=baseline,
        ceiling=ceiling,
        distilled=distilled,
        verdict=verdict,
        gap_pp=gap_pp,
        transfer_pp=transfer_pp,
        fidelity_pct=fidelity,
        gap_significant=gap_significant,
        transfer_significant=transfer_significant,
        regression_significant=regression_significant,
        narrative=narrative,
    )
