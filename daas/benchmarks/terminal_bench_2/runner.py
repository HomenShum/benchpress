"""Terminal-Bench 2.0 adapter — Docker-harness-dependent scoring."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from daas.benchmarks import BenchmarkResult

TERMINAL_BENCH_CACHE_DIR = (
    Path(__file__).resolve().parent.parent / "_cache" / "terminal_bench_2"
)


def harness_available() -> bool:
    """True iff terminal_bench harness is importable AND Docker is reachable."""
    try:
        import terminal_bench  # type: ignore  # noqa: F401
    except ImportError:
        return False
    # Cheap probe: Docker socket existence check
    import os
    import subprocess

    # Unix socket or Windows named pipe; skip probe and assume harness
    # will error informatively if docker is unreachable.
    if os.environ.get("DOCKER_HOST"):
        return True
    try:
        subprocess.run(
            ["docker", "--version"], capture_output=True, timeout=3, check=True
        )
        return True
    except Exception:
        return False


def load_tasks(limit: int = 20, *, force_refresh: bool = False) -> list[dict[str, Any]]:
    cached = TERMINAL_BENCH_CACHE_DIR / "tasks.jsonl"
    if cached.exists() and not force_refresh:
        with cached.open("r", encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh if line.strip()]
        return rows[:limit]
    try:
        from terminal_bench import list_tasks  # type: ignore
        rows = list(list_tasks(limit=limit))
        TERMINAL_BENCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with cached.open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        return rows
    except ImportError:
        raise RuntimeError(
            "terminal_bench harness not installed; "
            "pip install terminal-bench  (Docker also required)"
        )


def run_task(task: dict[str, Any], artifact: dict[str, Any]) -> BenchmarkResult:
    task_id = str(task.get("task_id") or task.get("id") or "unknown")
    meta = artifact.get("_meta") if isinstance(artifact, dict) else {}
    if not harness_available():
        return BenchmarkResult(
            benchmark_id="terminal_bench_2",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error=(
                "terminal_bench_missing_or_no_docker: install with "
                "`pip install terminal-bench` and ensure `docker` is reachable"
            ),
        )
    try:
        from terminal_bench import score  # type: ignore
        verdict = score(task=task, run=artifact)
        passed = bool(verdict.get("passed"))
        return BenchmarkResult(
            benchmark_id="terminal_bench_2",
            task_id=task_id,
            passed=passed,
            score=float(verdict.get("score", 1.0 if passed else 0.0)),
            raw_result={"verdict": verdict, "_meta": meta},
        )
    except Exception as exc:
        return BenchmarkResult(
            benchmark_id="terminal_bench_2",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error=f"harness_error: {type(exc).__name__}: {exc}",
        )
