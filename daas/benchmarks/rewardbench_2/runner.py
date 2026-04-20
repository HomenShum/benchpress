"""RewardBench 2 adapter — pairwise preference, loads from allenai/reward-bench."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from daas.benchmarks import BenchmarkResult
from daas.benchmarks.judgebench.runner import (
    _normalize_label,
    live_replay as _live_replay_judgebench,
)

REWARDBENCH_REPO = "allenai/reward-bench-2"
REWARDBENCH_CACHE_DIR = (
    Path(__file__).resolve().parent.parent / "_cache" / "rewardbench_2"
)


def load_tasks(
    limit: int = 50, *, split: str = "filtered", force_refresh: bool = False
) -> list[dict[str, Any]]:
    REWARDBENCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = REWARDBENCH_CACHE_DIR / f"{split}.jsonl"
    if cached.exists() and not force_refresh:
        with cached.open("r", encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh if line.strip()]
        return rows[:limit]
    try:
        from datasets import load_dataset  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pip install datasets") from exc
    # Upstream sometimes has different split names; try common ones.
    for candidate_split in (split, "filtered", "raw", "train"):
        try:
            ds = load_dataset(REWARDBENCH_REPO, split=candidate_split)
            break
        except Exception:
            continue
    else:
        raise RuntimeError(
            f"Could not load any known split from {REWARDBENCH_REPO}; "
            "upstream may have changed."
        )
    rows: list[dict[str, Any]] = []
    for i, item in enumerate(ds):  # type: ignore[assignment]
        rows.append(dict(item))
        if i + 1 >= limit:
            break
    with cached.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    return rows


def live_replay(task: dict[str, Any], **kw: Any) -> dict[str, Any]:
    # Remap task keys to judgebench shape
    remapped = {
        "question": task.get("prompt") or task.get("instruction") or task.get("question"),
        "response_A": task.get("chosen") or task.get("response_chosen") or task.get("response_A"),
        "response_B": task.get("rejected") or task.get("response_rejected") or task.get("response_B"),
    }
    return _live_replay_judgebench(remapped, **kw)


def run_task(task: dict[str, Any], artifact: dict[str, Any]) -> BenchmarkResult:
    task_id = str(
        task.get("id") or task.get("prompt_id") or task.get("task_id") or "unknown"
    )
    meta = artifact.get("_meta") if isinstance(artifact, dict) else {}
    meta_error = meta.get("error") if isinstance(meta, dict) else None

    # RewardBench 2 gold is always "chosen" (slotted as A in our prompt)
    if not task.get("chosen") and not task.get("response_chosen"):
        return BenchmarkResult(
            benchmark_id="rewardbench_2",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error="missing_chosen",
        )

    pick = artifact.get("pick") if isinstance(artifact, dict) else None
    passed = pick == "A"
    return BenchmarkResult(
        benchmark_id="rewardbench_2",
        task_id=task_id,
        passed=passed,
        score=1.0 if passed else 0.0,
        raw_result={"expected": "A", "actual": pick, "_meta": meta},
        harness_error=str(meta_error) if meta_error else None,
    )
