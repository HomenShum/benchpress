"""Arena-Hard-Auto adapter — delegates extraction/scoring to the
judgebench shape because Arena-Hard uses the same pairwise-preference
format."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from daas.benchmarks import BenchmarkResult
from daas.benchmarks.judgebench.runner import (
    _normalize_label,
    extract_pick,  # re-export
    live_replay as _live_replay_judgebench,  # same API
)

ARENA_HARD_REPO = "lmarena/arena-hard-auto"
ARENA_HARD_CACHE_DIR = (
    Path(__file__).resolve().parent.parent / "_cache" / "arena_hard_auto"
)


def load_tasks(limit: int = 50, *, force_refresh: bool = False) -> list[dict[str, Any]]:
    """Arena-Hard-Auto tasks live in the repo under
    `data/arena-hard-v0.1/question.jsonl`. Teams should either clone the
    repo or `pip install arena-hard-auto` and set ARENA_HARD_DATA path.
    This loader expects a local JSONL at
    daas/benchmarks/_cache/arena_hard_auto/tasks.jsonl.
    """
    cached = ARENA_HARD_CACHE_DIR / "tasks.jsonl"
    if not cached.exists():
        raise RuntimeError(
            f"Arena-Hard tasks not cached at {cached}. Clone "
            f"https://github.com/{ARENA_HARD_REPO} and copy the question "
            f"JSONL there, or pip install arena-hard-auto and point the file."
        )
    with cached.open("r", encoding="utf-8") as fh:
        rows = [json.loads(line) for line in fh if line.strip()]
    return rows[:limit]


def live_replay(task: dict[str, Any], **kw: Any) -> dict[str, Any]:
    # Reuse JudgeBench's pairwise live_replay since prompt shape is identical
    return _live_replay_judgebench(task, **kw)


def run_task(task: dict[str, Any], artifact: dict[str, Any]) -> BenchmarkResult:
    task_id = str(task.get("question_id") or task.get("id") or "unknown")
    meta = artifact.get("_meta") if isinstance(artifact, dict) else {}
    meta_error = meta.get("error") if isinstance(meta, dict) else None

    expected = task.get("gold") or task.get("label") or task.get("winner")
    if expected is None:
        return BenchmarkResult(
            benchmark_id="arena_hard_auto",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error="missing_gold",
        )
    pick = artifact.get("pick") if isinstance(artifact, dict) else None
    norm_expected = _normalize_label(expected)
    norm_pick = pick.upper() if isinstance(pick, str) else None
    passed = (
        norm_pick is not None
        and norm_expected is not None
        and norm_pick == norm_expected
    )
    return BenchmarkResult(
        benchmark_id="arena_hard_auto",
        task_id=task_id,
        passed=passed,
        score=1.0 if passed else 0.0,
        raw_result={"expected": norm_expected, "actual": norm_pick, "_meta": meta},
        harness_error=str(meta_error) if meta_error else None,
    )


__all__ = ["extract_pick", "live_replay", "load_tasks", "run_task"]
