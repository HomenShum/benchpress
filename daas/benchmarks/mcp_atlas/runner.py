"""MCP-Atlas adapter — harness-dependent scoring with honest fallback."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from daas.benchmarks import BenchmarkResult

MCP_ATLAS_CACHE_DIR = Path(__file__).resolve().parent.parent / "_cache" / "mcp_atlas"


def harness_available() -> bool:
    """True iff mcp_atlas Python package is importable."""
    try:
        import mcp_atlas  # type: ignore  # noqa: F401
        return True
    except ImportError:
        return False


def load_tasks(limit: int = 50, *, force_refresh: bool = False) -> list[dict[str, Any]]:
    """Load tasks from the public 500-task subset.

    When the harness is installed, delegates to its loader.
    When not, reads the HF / GitHub JSONL mirror if cached locally at
    ``daas/benchmarks/_cache/mcp_atlas/tasks.jsonl``.
    """
    cached = MCP_ATLAS_CACHE_DIR / "tasks.jsonl"
    if cached.exists() and not force_refresh:
        with cached.open("r", encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh if line.strip()]
        return rows[:limit]

    if harness_available():
        try:
            from mcp_atlas import load_public_subset  # type: ignore
            rows = list(load_public_subset(limit=limit))
            MCP_ATLAS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with cached.open("w", encoding="utf-8") as fh:
                for r in rows:
                    fh.write(json.dumps(r, ensure_ascii=False) + "\n")
            return rows
        except Exception:
            # Harness present but loader shape shifted — fall through
            pass
    raise RuntimeError(
        "MCP-Atlas tasks not cached locally and harness not installed. "
        "Install with `pip install -e git+https://github.com/mcp-atlas/mcp-atlas` "
        f"or place a JSONL at {cached}."
    )


def run_task(task: dict[str, Any], artifact: dict[str, Any]) -> BenchmarkResult:
    task_id = str(task.get("task_id") or task.get("id") or "unknown")
    meta = artifact.get("_meta") if isinstance(artifact, dict) else {}
    if not harness_available():
        return BenchmarkResult(
            benchmark_id="mcp_atlas",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error=(
                "mcp_atlas_harness_missing: install with "
                "`pip install -e git+https://github.com/mcp-atlas/mcp-atlas`"
            ),
        )
    # Delegate to upstream scorer
    try:
        from mcp_atlas import score_run  # type: ignore
        verdict = score_run(task=task, run=artifact)
        passed = bool(verdict.get("passed"))
        return BenchmarkResult(
            benchmark_id="mcp_atlas",
            task_id=task_id,
            passed=passed,
            score=float(verdict.get("score", 1.0 if passed else 0.0)),
            raw_result={"verdict": verdict, "_meta": meta},
        )
    except Exception as exc:
        return BenchmarkResult(
            benchmark_id="mcp_atlas",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error=f"harness_error: {type(exc).__name__}: {exc}",
        )
