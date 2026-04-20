"""Core types for fidelity measurement.

Design rules enforced in the schema:
  * TransferVerdict is a bounded enum — never free-form.
  * Measurement stores k / n / CI — never just a point estimate.
  * FidelityTrial captures all three measurements + their provenance so
    verdicts can be recomputed if the classification logic evolves.
  * Externalization.form is bounded; new forms require code changes.

These types are duplicated in convex/domains/daas/schema.ts — change
both sides together.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


# Bounded enum: every possible verdict the classifier can return.
# Mirrored in convex/domains/daas/schema.ts::DAAS_TRANSFER_VERDICTS.
VERDICT_VALUES = (
    "transfers",         # distilled > baseline AND distilled approaches ceiling
    "lossy",             # distilled > baseline but < ceiling (partial transfer)
    "no_gap",            # ceiling ~ baseline (nothing to transfer)
    "regression",        # distilled < baseline (scaffold hurts)
    "insufficient_data", # n too small / CIs too wide to conclude
)

TransferVerdict = Literal[
    "transfers",
    "lossy",
    "no_gap",
    "regression",
    "insufficient_data",
]

ExternalizationForm = Literal[
    "prompt",          # system-prompt string / preamble rewrite
    "tool_schema",     # tool allowlist + response schema
    "scaffold_graph",  # full agent graph (workers, handoffs, rules)
]


@dataclass(frozen=True)
class Measurement:
    """A single (small | large | distilled) measurement over N tasks.

    ``passed`` / ``total`` are raw counts. The CI is Wilson at 95%. We
    NEVER store just a point estimate — downstream comparisons need the
    interval to avoid claiming significance where none exists.
    """

    model: str
    passed: int
    total: int
    ci_lo: float  # Wilson lower bound (0..1)
    ci_hi: float  # Wilson upper bound (0..1)
    avg_cost_usd: float = 0.0
    avg_duration_ms: float = 0.0
    harness_errors: int = 0  # tasks that errored before scoring (excluded from passed/total)

    @property
    def rate(self) -> float:
        return self.passed / self.total if self.total else 0.0


@dataclass(frozen=True)
class Externalization:
    """A compile-time distillation artifact.

    ``artifact`` is form-specific:
      prompt        -> {"system_prompt": str, "notes": str}
      tool_schema   -> {"tools": [...], "schema": {...}}
      scaffold_graph -> {"workers": [...], "edges": [...], "rules": [...]}

    Keep under 32KB (BOUND_READ) — the whole artifact is loaded into the
    small model's prompt on every call in the distilled measurement.
    """

    id: str                           # stable identifier, used in trial rows
    form: ExternalizationForm
    artifact: dict[str, Any]
    source_model: str                 # which big model this was distilled from
    source_trace_ids: list[str] = field(default_factory=list)
    notes: str = ""


@dataclass(frozen=True)
class FidelityTrial:
    """One task run through the 3-measurement template.

    Per-task trials aggregate into a verdict via classify(). Storing the
    raw trials (not just the aggregate) lets us:
      * recompute verdicts when classifier logic changes
      * drill into which tasks the externalization hurt vs helped
      * split rollups by subject / category post-hoc
    """

    task_id: str
    benchmark_id: str
    externalization_id: str
    baseline_passed: bool
    ceiling_passed: bool
    distilled_passed: bool
    baseline_cost_usd: float = 0.0
    ceiling_cost_usd: float = 0.0
    distilled_cost_usd: float = 0.0
    baseline_error: str | None = None
    ceiling_error: str | None = None
    distilled_error: str | None = None


@dataclass(frozen=True)
class FidelityVerdict:
    """Aggregated verdict across N trials.

    ``fidelity_pct`` is (transfer / gap) when gap > 0, else None. Ranges:
      * ~100% -> full transfer (distilled matches ceiling)
      * ~0%   -> no transfer (scaffold didn't help)
      * <0%   -> regression (scaffold hurt, classified separately)
    """

    externalization_id: str
    benchmark_id: str
    baseline: Measurement
    ceiling: Measurement
    distilled: Measurement
    verdict: TransferVerdict
    gap_pp: float                 # ceiling.rate - baseline.rate in percentage points
    transfer_pp: float            # distilled.rate - baseline.rate in percentage points
    fidelity_pct: float | None    # transfer / gap, None when gap <= 0
    gap_significant: bool         # Newcombe CI on (ceiling - baseline) excludes 0
    transfer_significant: bool    # Newcombe CI on (distilled - baseline) excludes 0
    regression_significant: bool  # Newcombe CI on (baseline - distilled) excludes 0
    narrative: str                # one-line human explanation
