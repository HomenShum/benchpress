"""SWE-bench Verified adapter — Docker-sandbox unit-test scoring."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from daas.benchmarks import BenchmarkResult

SWEBENCH_VERIFIED_REPO = "princeton-nlp/SWE-bench_Verified"
SWEBENCH_CACHE_DIR = (
    Path(__file__).resolve().parent.parent / "_cache" / "swebench_verified"
)


def harness_available() -> bool:
    """True iff swebench-eval is importable and docker is reachable."""
    try:
        import swebench  # type: ignore  # noqa: F401
    except ImportError:
        return False
    import subprocess

    try:
        subprocess.run(
            ["docker", "--version"], capture_output=True, timeout=3, check=True
        )
        return True
    except Exception:
        return False


def load_tasks(
    limit: int = 20,
    *,
    split: str = "test",
    force_refresh: bool = False,
) -> list[dict[str, Any]]:
    SWEBENCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = SWEBENCH_CACHE_DIR / f"{split}.jsonl"
    if cached.exists() and not force_refresh:
        with cached.open("r", encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh if line.strip()]
        return rows[:limit]

    try:
        from datasets import load_dataset  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pip install datasets") from exc

    ds = load_dataset(SWEBENCH_VERIFIED_REPO, split=split)
    rows: list[dict[str, Any]] = []
    for i, item in enumerate(ds):  # type: ignore[assignment]
        rows.append(dict(item))
        if i + 1 >= limit:
            break
    with cached.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    return rows


def run_task(task: dict[str, Any], artifact: dict[str, Any]) -> BenchmarkResult:
    task_id = str(task.get("instance_id") or task.get("task_id") or "unknown")
    meta = artifact.get("_meta") if isinstance(artifact, dict) else {}
    if not harness_available():
        return BenchmarkResult(
            benchmark_id="swebench_verified",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error=(
                "swebench_harness_missing_or_no_docker: install with "
                "`pip install swebench-eval` and ensure docker is reachable. "
                "~100GB disk for Docker images required."
            ),
        )

    patch = artifact.get("patch") or artifact.get("diff")
    if not patch:
        return BenchmarkResult(
            benchmark_id="swebench_verified",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error="no_patch_in_artifact",
        )
    try:
        from swebench.harness.run_evaluation import run_instance  # type: ignore
        result = run_instance(instance=task, prediction={"model_patch": patch})
        # Upstream return: {resolved: bool, tests_pass_to_pass, tests_fail_to_pass}
        passed = bool(result.get("resolved"))
        # Score: pass_rate across unit tests
        pp = result.get("tests_pass_to_pass") or {}
        fp = result.get("tests_fail_to_pass") or {}
        total = len(pp.get("success", [])) + len(pp.get("failure", []))
        total += len(fp.get("success", [])) + len(fp.get("failure", []))
        succ = len(pp.get("success", [])) + len(fp.get("success", []))
        score = (succ / total) if total else (1.0 if passed else 0.0)
        return BenchmarkResult(
            benchmark_id="swebench_verified",
            task_id=task_id,
            passed=passed,
            score=score,
            raw_result={"harness_result": result, "_meta": meta},
        )
    except Exception as exc:
        return BenchmarkResult(
            benchmark_id="swebench_verified",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error=f"harness_error: {type(exc).__name__}: {exc}",
        )
