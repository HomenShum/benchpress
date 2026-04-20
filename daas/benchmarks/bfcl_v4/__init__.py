"""BFCL v4 — agentic evaluation (upgrade from v3 tool-call AST matching).

Source: https://gorilla.cs.berkeley.edu/leaderboard.html
BFCL v4 reframes itself as "from tool use to agentic evaluation". It
retains the v3 AST-comparison primitive for pure function-calling
tasks but adds multi-turn agentic scenarios with tool discovery,
parameter recovery, and syntax tests.

Design choice: this adapter REUSES daas.benchmarks.bfcl for tasks
where v3 and v4 share a format (simple / multiple / parallel) and
augments with v4-only categories (agentic_core, agentic_tool_discovery)
when the upstream rolls those into the HF dataset.

Today: delegates to v3 loader with the v4 benchmark_id namespace so
Fidelity rollups differentiate cleanly. When the upstream dataset
ships a v4-specific split identifier, bump BFCL_V4_DATASET_CONFIG.
"""

from daas.benchmarks.bfcl import (  # re-export for drop-in use
    load_tasks as _load_tasks_v3,
    run_task as _run_task_v3,
    to_bfcl_format,
)
from daas.benchmarks.bfcl.runner import score_calls
from daas.benchmarks.bfcl.live import live_replay as _live_replay_v3
from daas.benchmarks import BenchmarkResult
from typing import Any

# Flip this when the Gorilla team publishes a stable v4 dataset slug.
# Until then, v4 is evaluated using the v3 corpus + v4 stricter scoring.
BFCL_V4_DATASET_CONFIG = "bfcl_v3_transitional"


def load_tasks(category: str, limit: int = 50) -> list[dict]:
    return _load_tasks_v3(category=category, limit=limit)


def live_replay(task: dict, **kw: Any) -> dict:
    return _live_replay_v3(task, **kw)


def run_task(task: dict, artifact: dict) -> BenchmarkResult:
    """Delegate to v3 scoring but rebrand the benchmark_id so rollups
    can track BFCL v4 runs separately when the upstream v4 corpus lands."""
    base = _run_task_v3(task, artifact)
    return BenchmarkResult(
        benchmark_id="bfcl_v4",
        task_id=base.task_id,
        passed=base.passed,
        score=base.score,
        raw_result=base.raw_result,
        harness_error=base.harness_error,
    )


__all__ = ["BFCL_V4_DATASET_CONFIG", "load_tasks", "live_replay", "run_task", "to_bfcl_format", "score_calls"]
