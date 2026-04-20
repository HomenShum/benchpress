"""IF-RewardBench adapter — load tasks, pairwise judge, exact-match score.

Task schema (normalized from the HF mirror — v1 uses `chosen_response` /
`rejected_response` columns):

    task_id          : str
    prompt           : str          # the instruction
    response_chosen  : str          # preference-gold preferred response
    response_rejected: str          # other response
    turn_type        : "single_turn" | "multi_turn" | "system_prompt"
    checklist        : list[str]    # named boolean checks the judge can use

Scoring: judge picks chosen vs rejected by canonical extraction; exact
match against gold.
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

IF_REWARDBENCH_REPO = "allenai/IF-RewardBench"
IF_REWARDBENCH_CACHE_DIR = (
    Path(__file__).resolve().parent.parent / "_cache" / "if_rewardbench"
)

GEMINI_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/"
    "models/{model}:generateContent?key={key}"
)
FLASH_LITE_INPUT_USD_PER_TOK = 0.10 / 1_000_000
FLASH_LITE_OUTPUT_USD_PER_TOK = 0.40 / 1_000_000
PRO_INPUT_USD_PER_TOK = 1.25 / 1_000_000
PRO_OUTPUT_USD_PER_TOK = 5.00 / 1_000_000


def _resolve_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    env_local = Path(
        "D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/nodebench-ai/.env.local"
    )
    if env_local.exists():
        for line in env_local.read_text(encoding="utf-8").splitlines():
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("GEMINI_API_KEY not set")


def load_tasks(
    limit: int = 50, *, split: str = "test", force_refresh: bool = False
) -> list[dict[str, Any]]:
    """Load `limit` IF-RewardBench tasks."""
    IF_REWARDBENCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = IF_REWARDBENCH_CACHE_DIR / f"{split}.jsonl"
    if cached.exists() and not force_refresh:
        with cached.open("r", encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh if line.strip()]
        if rows:
            return rows[:limit]

    try:
        from datasets import load_dataset  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pip install datasets") from exc

    ds = load_dataset(IF_REWARDBENCH_REPO, split=split)
    rows: list[dict[str, Any]] = []
    for i, item in enumerate(ds):  # type: ignore[assignment]
        rows.append(dict(item))
        if i + 1 >= limit:
            break
    with cached.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    return rows


_PICK_PATTERNS = [
    re.compile(r"\b(?:the\s+)?(?:better|chosen|preferred)\s+(?:answer|response)\s+is\s+\(?([AB])\)?", re.IGNORECASE),
    re.compile(r"\banswer[:=\s]*\(?([AB])\)?", re.IGNORECASE),
    re.compile(r"\\boxed\{\s*([AB])\s*\}", re.IGNORECASE),
    re.compile(r"response\s*\(?([AB])\)?\s+is\s+better", re.IGNORECASE),
]


def extract_pick(text: str | None) -> str | None:
    if not text:
        return None
    for pat in _PICK_PATTERNS:
        m = pat.search(text)
        if m:
            return m.group(1).upper()
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    if lines and re.fullmatch(r"\(?([AB])\)?\.?", lines[-1]):
        m = re.fullmatch(r"\(?([AB])\)?\.?", lines[-1])
        if m:
            return m.group(1).upper()
    return None


def _task_id(task: dict[str, Any]) -> str:
    for k in ("task_id", "id", "prompt_id"):
        if k in task and task[k] is not None:
            return str(task[k])
    import hashlib
    return hashlib.sha256(str(task.get("prompt", "")).encode()).hexdigest()[:12]


def _format_prompt(task: dict[str, Any]) -> str:
    prompt = str(task.get("prompt") or task.get("instruction") or "")
    chosen = str(task.get("response_chosen") or task.get("chosen") or "")
    rejected = str(task.get("response_rejected") or task.get("rejected") or "")
    checklist = task.get("checklist") or []
    checklist_block = (
        "\n".join(f"- {c}" for c in checklist)
        if isinstance(checklist, list) and checklist
        else "(no explicit checklist; use your best judgment about correctness and instruction-following)"
    )
    return (
        "You are evaluating which response follows the user's instruction better.\n"
        "Score correctness + instruction adherence only — not length or stylistic polish.\n\n"
        f"INSTRUCTION:\n{prompt}\n\n"
        f"RESPONSE A:\n{chosen}\n\n"
        f"RESPONSE B:\n{rejected}\n\n"
        f"CHECKLIST (the response should satisfy these):\n{checklist_block}\n\n"
        "Reason through each checklist item, then state your answer on a new line "
        'as "The better answer is X" where X is A or B.'
    )


def live_replay(
    task: dict[str, Any],
    *,
    api_key: str | None = None,
    model: str = "gemini-3.1-flash-lite-preview",
) -> dict[str, Any]:
    key = api_key or _resolve_api_key()
    max_tokens = 4096 if "pro" in model else 2048
    body = {
        "contents": [{"role": "user", "parts": [{"text": _format_prompt(task)}]}],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": max_tokens},
    }
    url = GEMINI_URL_TEMPLATE.format(model=model, key=key)
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return _err(model, started, f"HTTPError {exc.code}: {(exc.read() or b'').decode()[:400]}")
    except Exception as exc:
        return _err(model, started, f"{type(exc).__name__}: {exc}")
    duration_ms = int((time.time() - started) * 1000)

    text = ""
    finish_reason = None
    cands = payload.get("candidates") or []
    if cands:
        c0 = cands[0]
        finish_reason = c0.get("finishReason")
        text = "".join(str(p.get("text", "")) for p in (c0.get("content") or {}).get("parts") or [])
    pick = extract_pick(text)
    truncation = None
    if finish_reason == "MAX_TOKENS" and pick is None:
        truncation = f"truncated_at_max_tokens ({max_tokens})"

    usage = payload.get("usageMetadata") or {}
    in_tok = int(usage.get("promptTokenCount", 0))
    out_tok = int(usage.get("candidatesTokenCount", 0))
    if "pro" in model:
        cost = in_tok * PRO_INPUT_USD_PER_TOK + out_tok * PRO_OUTPUT_USD_PER_TOK
    else:
        cost = in_tok * FLASH_LITE_INPUT_USD_PER_TOK + out_tok * FLASH_LITE_OUTPUT_USD_PER_TOK
    return {
        "pick": pick,
        "response_text": text,
        "_meta": {
            "model": model,
            "input_tokens": in_tok,
            "output_tokens": out_tok,
            "cost_usd": cost,
            "duration_ms": duration_ms,
            "finish_reason": finish_reason,
            "error": truncation,
        },
    }


def _err(model: str, started: float, msg: str) -> dict[str, Any]:
    return {
        "pick": None,
        "response_text": "",
        "_meta": {
            "model": model,
            "input_tokens": 0,
            "output_tokens": 0,
            "cost_usd": 0.0,
            "duration_ms": int((time.time() - started) * 1000),
            "error": msg,
        },
    }


def run_task(task: dict[str, Any], artifact: dict[str, Any]) -> BenchmarkResult:
    """In this benchmark, the prompt presents chosen as A and rejected as B.
    Gold is therefore ALWAYS 'A' — we measure whether the judge picks it."""
    task_id = _task_id(task)
    meta = artifact.get("_meta") if isinstance(artifact, dict) else {}
    meta_error = meta.get("error") if isinstance(meta, dict) else None

    if not task.get("response_chosen") and not task.get("chosen"):
        return BenchmarkResult(
            benchmark_id="if_rewardbench",
            task_id=task_id,
            passed=False,
            score=0.0,
            raw_result={"_meta": meta},
            harness_error="missing_response_chosen",
        )

    pick = artifact.get("pick") if isinstance(artifact, dict) else None
    passed = pick == "A"
    return BenchmarkResult(
        benchmark_id="if_rewardbench",
        task_id=task_id,
        passed=passed,
        score=1.0 if passed else 0.0,
        raw_result={
            "expected": "A",  # chosen is always slotted as A
            "actual": pick,
            "turn_type": task.get("turn_type"),
            "_meta": meta,
        },
        harness_error=str(meta_error) if meta_error else None,
    )
