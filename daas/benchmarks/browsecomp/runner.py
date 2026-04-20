"""BrowseComp adapter — exact-match scoring on short factual answers.

The agent under test is expected to browse the web externally; this
adapter just scores the final answer string.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from daas.benchmarks import BenchmarkResult

# BrowseComp does not currently ship a public HF mirror. Teams download
# the official JSONL from https://openai.com/index/browsecomp/ and
# place it at daas/benchmarks/_cache/browsecomp/tasks.jsonl.
BROWSECOMP_CACHE_DIR = (
    Path(__file__).resolve().parent.parent / "_cache" / "browsecomp"
)
BROWSECOMP_DEFAULT_FILE = BROWSECOMP_CACHE_DIR / "tasks.jsonl"


def load_tasks(limit: int = 50, *, path: Path | None = None) -> list[dict[str, Any]]:
    """Load tasks from a local JSONL.

    Offering this via HF download requires a license agreement with
    OpenAI. Teams who agreed can place the file at
    ``daas/benchmarks/_cache/browsecomp/tasks.jsonl``.
    """
    src = path or BROWSECOMP_DEFAULT_FILE
    if not src.exists():
        raise RuntimeError(
            f"BrowseComp tasks not found at {src}. Obtain the JSONL from "
            "https://openai.com/index/browsecomp/ and place it there. "
            "This adapter does not auto-download due to license terms."
        )
    with src.open("r", encoding="utf-8") as fh:
        rows = [json.loads(line) for line in fh if line.strip()]
    return rows[:limit]


_ANSWER_PATTERNS = [
    re.compile(r"\bfinal answer[:\s]+(.+?)(?:\n|$)", re.IGNORECASE),
    re.compile(r"\banswer[:\s]+(.+?)(?:\n|$)", re.IGNORECASE),
    re.compile(r"\\boxed\{([^}]+)\}"),
]


def extract_answer(text: str | None) -> str | None:
    if not text:
        return None
    for pat in _ANSWER_PATTERNS:
        m = pat.search(text)
        if m:
            return m.group(1).strip().rstrip(".").strip()
    # Last non-empty line as fallback
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    if lines:
        return lines[-1].rstrip(".").strip()
    return None


def _normalize(s: str | None) -> str | None:
    if s is None:
        return None
    return re.sub(r"\s+", " ", s.strip().lower()).rstrip(".")


def live_replay(task: dict[str, Any], **_: Any) -> dict[str, Any]:
    """BrowseComp requires the agent to actually browse. This adapter's
    live_replay is a stub that records an intentional harness_error —
    use your agent's own runner to produce the artifact and pass it
    into run_task."""
    return {
        "answer_text": "",
        "_meta": {
            "model": "none",
            "input_tokens": 0,
            "output_tokens": 0,
            "cost_usd": 0.0,
            "duration_ms": 0,
            "error": "browsecomp_requires_external_browsing_agent",
        },
    }


def run_task(task: dict[str, Any], artifact: dict[str, Any]) -> BenchmarkResult:
    task_id = str(task.get("task_id") or task.get("id") or "unknown")
    meta = artifact.get("_meta") if isinstance(artifact, dict) else {}
    meta_error = meta.get("error") if isinstance(meta, dict) else None

    expected = task.get("answer") or task.get("gold_answer")
    if expected is None:
        return BenchmarkResult(
            benchmark_id="browsecomp",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error="missing_gold_answer",
        )

    # Extract from full response text if answer_text not pre-extracted
    actual_raw = (
        artifact.get("answer")
        or artifact.get("answer_text")
        or extract_answer(artifact.get("response_text"))
    )
    passed = _normalize(actual_raw) == _normalize(str(expected))
    return BenchmarkResult(
        benchmark_id="browsecomp",
        task_id=task_id,
        passed=passed,
        score=1.0 if passed else 0.0,
        raw_result={
            "expected": expected,
            "actual": actual_raw,
            "_meta": meta,
        },
        harness_error=str(meta_error) if meta_error else None,
    )
