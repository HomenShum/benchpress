"""Scenario tests for fidelity verdict classification.

These tests are the HONESTY contract. If you find a way to claim
"transfers" when the 3-measurement template shouldn't support it, add
a test here that fails before the fix.
"""

from __future__ import annotations

import math

from daas.fidelity.types import FidelityTrial
from daas.fidelity.verdict import (
    FIDELITY_TRANSFERS_THRESHOLD,
    MIN_TRIALS_FOR_CLASSIFICATION,
    classify,
    newcombe_diff_ci,
    wilson_ci,
)


# ---------------------------------------------------------------------------
# Test fixtures — build a list of FidelityTrials with specific pass rates
# ---------------------------------------------------------------------------


def _trials(
    n: int, base_pass: int, ceil_pass: int, dist_pass: int
) -> list[FidelityTrial]:
    """Build n trials with specified pass counts per measurement.

    First `base_pass` trials have baseline_passed=True, and so on per col.
    Simpler than randomizing; what matters is the aggregate counts.
    """
    out = []
    for i in range(n):
        out.append(
            FidelityTrial(
                task_id=f"t{i}",
                benchmark_id="test",
                externalization_id="ext_test",
                baseline_passed=i < base_pass,
                ceiling_passed=i < ceil_pass,
                distilled_passed=i < dist_pass,
                baseline_cost_usd=0.0001,
                ceiling_cost_usd=0.001,
                distilled_cost_usd=0.0001,
            )
        )
    return out


# ---------------------------------------------------------------------------
# Wilson CI — unit
# ---------------------------------------------------------------------------


def test_wilson_ci_small_n_wider_than_large_n() -> None:
    lo10, hi10 = wilson_ci(5, 10)
    lo100, hi100 = wilson_ci(50, 100)
    assert (hi10 - lo10) > (hi100 - lo100)


def test_wilson_ci_90_pct_at_n50_has_expected_halfwidth() -> None:
    lo, hi = wilson_ci(45, 50)
    assert 0.75 < lo < 0.82
    assert 0.93 < hi < 0.97


def test_wilson_ci_zero_and_perfect_are_bounded() -> None:
    lo0, hi0 = wilson_ci(0, 50)
    lo1, hi1 = wilson_ci(50, 50)
    # lo0 can be ~1e-17 due to float arithmetic; treat as zero
    assert lo0 < 1e-6 and hi0 < 0.1
    assert hi1 == 1.0 and lo1 > 0.9


def test_wilson_ci_n_zero_returns_zeros_no_crash() -> None:
    assert wilson_ci(0, 0) == (0.0, 0.0)


# ---------------------------------------------------------------------------
# Newcombe difference CI — unit
# ---------------------------------------------------------------------------


def test_newcombe_identical_proportions_ci_spans_zero() -> None:
    # pa = pb -> CI on (pa - pb) must span 0
    lo, hi = newcombe_diff_ci(50, 100, 50, 100)
    assert lo < 0 < hi


def test_newcombe_big_gap_at_large_n_excludes_zero() -> None:
    # 90% vs 60% at n=100 -> huge difference, CI must exclude 0
    lo, hi = newcombe_diff_ci(90, 100, 60, 100)
    assert lo > 0


def test_newcombe_small_gap_small_n_spans_zero() -> None:
    # 90% vs 85% at n=20 -> borderline, CI should span 0 (not significant)
    lo, hi = newcombe_diff_ci(18, 20, 17, 20)
    assert lo < 0 < hi


# ---------------------------------------------------------------------------
# classify — verdict decision tree
# ---------------------------------------------------------------------------


def test_classify_insufficient_data_below_min_trials() -> None:
    trials = _trials(30, base_pass=20, ceil_pass=28, dist_pass=27)
    v = classify(trials, "ext1", "bench1")
    assert v.verdict == "insufficient_data"
    assert str(MIN_TRIALS_FOR_CLASSIFICATION) in v.narrative


def test_classify_no_gap_when_ceiling_not_above_baseline() -> None:
    # baseline 90, ceiling 91 at n=100 -> not significant, no gap to transfer
    trials = _trials(100, base_pass=90, ceil_pass=91, dist_pass=90)
    v = classify(trials, "ext1", "bench1")
    assert v.verdict == "no_gap"
    assert v.gap_significant is False


def test_classify_transfers_when_distilled_approaches_ceiling() -> None:
    # Big real gap (60 -> 90), scaffold closes most of it (60 -> 87). n large.
    trials = _trials(200, base_pass=120, ceil_pass=180, dist_pass=174)
    v = classify(trials, "ext1", "bench1")
    assert v.verdict == "transfers"
    assert v.gap_significant is True
    assert v.transfer_significant is True
    assert v.fidelity_pct is not None
    assert v.fidelity_pct >= FIDELITY_TRANSFERS_THRESHOLD


def test_classify_lossy_when_transfer_partial() -> None:
    # Big real gap (60 -> 90), scaffold closes half (60 -> 75). Real lift but
    # not full transfer.
    trials = _trials(200, base_pass=120, ceil_pass=180, dist_pass=150)
    v = classify(trials, "ext1", "bench1")
    assert v.verdict == "lossy"
    assert v.gap_significant is True
    assert v.transfer_significant is True
    assert v.fidelity_pct is not None
    assert v.fidelity_pct < FIDELITY_TRANSFERS_THRESHOLD


def test_classify_lossy_when_gap_real_but_transfer_not_significant() -> None:
    # Gap is real, scaffold moves needle a tiny amount that's NOT significant
    trials = _trials(200, base_pass=120, ceil_pass=180, dist_pass=124)
    v = classify(trials, "ext1", "bench1")
    assert v.verdict == "lossy"
    assert v.gap_significant is True
    assert v.transfer_significant is False


def test_classify_regression_when_distilled_below_baseline_significant() -> None:
    # Scaffold actively hurts: baseline 90/100, distilled 60/100
    trials = _trials(200, base_pass=180, ceil_pass=190, dist_pass=120)
    v = classify(trials, "ext1", "bench1")
    assert v.verdict == "regression"
    assert v.regression_significant is True


def test_classify_handles_zero_gap_without_division_error() -> None:
    # Gap_pp = 0. Should not crash on fidelity_pct division.
    trials = _trials(100, base_pass=70, ceil_pass=70, dist_pass=70)
    v = classify(trials, "ext1", "bench1")
    # Ceiling == baseline -> no_gap
    assert v.verdict == "no_gap"
    assert v.fidelity_pct is None


def test_classify_harness_errors_excluded_from_rate() -> None:
    # 100 trials but 20 have errors — effective n = 80
    trials = _trials(80, base_pass=60, ceil_pass=72, dist_pass=70)
    errored = [
        FidelityTrial(
            task_id=f"err_{i}",
            benchmark_id="test",
            externalization_id="ext_test",
            baseline_passed=False,
            ceiling_passed=False,
            distilled_passed=False,
            baseline_error="TIMEOUT",
        )
        for i in range(20)
    ]
    v = classify(trials + errored, "ext1", "bench1")
    assert v.baseline.total == 80  # errored rows excluded
    assert v.baseline.harness_errors == 20


def test_classify_narrative_is_actionable() -> None:
    # Every verdict must carry a narrative that tells the operator what to do next
    cases = [
        _trials(200, 120, 180, 174),  # transfers
        _trials(200, 120, 180, 150),  # lossy
        _trials(100, 90, 91, 90),     # no_gap
        _trials(200, 180, 190, 120),  # regression
        _trials(30, 20, 28, 27),      # insufficient
    ]
    for trials in cases:
        v = classify(trials, "ext1", "bench1")
        assert len(v.narrative) > 20  # non-trivial explanation
        # Each verdict's narrative mentions a concrete next action
        action_words = ("ship", "route", "redistill", "remove", "more trials", "run more")
        assert any(w in v.narrative.lower() for w in action_words), (
            f"verdict {v.verdict} narrative lacks action: {v.narrative}"
        )


def test_classify_fidelity_is_ratio_of_transfer_over_gap() -> None:
    # Gap = 30pp, transfer = 12pp -> fidelity = 40%
    trials = _trials(200, base_pass=120, ceil_pass=180, dist_pass=144)
    v = classify(trials, "ext1", "bench1")
    assert v.transfer_significant is True
    # 24/60 = 0.4
    expected = v.transfer_pp / v.gap_pp
    assert v.fidelity_pct is not None
    assert math.isclose(v.fidelity_pct, expected, rel_tol=1e-9)
