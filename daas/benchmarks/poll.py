"""PoLL — Panel of LLMs, implemented as a thin orchestrator.

Source framing: "PoLL: Panel of LLMs as a Judge" — using a panel of
diverse smaller judges outperforms one large judge and reduces
intra-model bias while being ~7x cheaper.

## When to use

Use PoLL for open-ended residuals (the ~10% of judge calls that
deterministic oracles can't decide). Never use PoLL as your ONLY
judge; the deterministic oracle always runs first (see
fidelity.verdict.classify).

## Design

Given a task and a list of judges (each a callable that takes the
task and returns a pick + confidence), PoLL:
  1. Runs all judges in parallel (single shot each).
  2. Computes majority vote on the pick.
  3. Flags LOW_CONFIDENCE when vote split < 66%.
  4. Returns the panel's pick + per-judge verdicts for audit.

HONEST_STATUS: a judge that errors contributes 0 vote and is logged
as an error — it does not get to abstain silently.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any, Callable

JudgeFn = Callable[[dict[str, Any]], dict[str, Any]]
"""Each judge takes a task and returns
{ "pick": "A" | "B" | None, "confidence": float, "error": str | None }."""


@dataclass(frozen=True)
class PoLLJudgeResult:
    judge_id: str
    pick: str | None
    confidence: float
    error: str | None = None


@dataclass(frozen=True)
class PoLLVerdict:
    pick: str | None
    vote_distribution: dict[str, int]
    confidence: float  # fraction of panel that voted the winning pick
    panel_size: int
    errors: int
    per_judge: list[PoLLJudgeResult]
    low_confidence: bool


LOW_CONFIDENCE_THRESHOLD = 0.66  # <=66% agreement = flag as low confidence


def run_panel(task: dict[str, Any], judges: dict[str, JudgeFn]) -> PoLLVerdict:
    """Run a panel of named judges on one task and return a verdict.

    ``judges`` is a dict of judge_id -> JudgeFn so the verdict's
    per_judge list names WHO voted what.
    """
    results: list[PoLLJudgeResult] = []
    errors = 0
    for judge_id, fn in judges.items():
        try:
            out = fn(task)
            pick_raw = out.get("pick")
            pick = pick_raw.upper() if isinstance(pick_raw, str) else None
            conf = float(out.get("confidence", 1.0))
            err = out.get("error")
            results.append(
                PoLLJudgeResult(judge_id=judge_id, pick=pick, confidence=conf, error=err)
            )
            if err:
                errors += 1
        except Exception as exc:
            errors += 1
            results.append(
                PoLLJudgeResult(
                    judge_id=judge_id,
                    pick=None,
                    confidence=0.0,
                    error=f"{type(exc).__name__}: {exc}",
                )
            )

    picks = [r.pick for r in results if r.pick is not None]
    counts: Counter[str] = Counter(picks)
    if not counts:
        return PoLLVerdict(
            pick=None,
            vote_distribution={},
            confidence=0.0,
            panel_size=len(judges),
            errors=errors,
            per_judge=results,
            low_confidence=True,
        )
    winner, winner_count = counts.most_common(1)[0]
    # Tie detection: two or more picks share the max count
    top_count = counts.most_common(1)[0][1]
    ties = [p for p, c in counts.items() if c == top_count]
    if len(ties) > 1:
        # Panel is split — refuse to emit a deterministic pick
        return PoLLVerdict(
            pick=None,
            vote_distribution=dict(counts),
            confidence=top_count / len(judges),
            panel_size=len(judges),
            errors=errors,
            per_judge=results,
            low_confidence=True,
        )
    conf = winner_count / len(judges)
    return PoLLVerdict(
        pick=winner,
        vote_distribution=dict(counts),
        confidence=conf,
        panel_size=len(judges),
        errors=errors,
        per_judge=results,
        low_confidence=conf <= LOW_CONFIDENCE_THRESHOLD,
    )
