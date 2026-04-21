"""Broadened runtime-fidelity runner — per-category scaffold evaluation.

Runs the 8 scenarios from ``broadened_eval_scenarios`` across:
    A  baseline           Flash Lite solo (direct generateContent,
                          toolConfig.mode=ANY, single declared tool)
    B  tool_first_chain   Flash Lite via the emitted scaffold
                          (with the prompt + mode=ANY fixes from
                          commit ae20800)

Reports pass rates PER CATEGORY so we can see which tool surfaces
the scaffold preserves baseline on and which it regresses on.

Usage:
    python -m daas.benchmarks.scaffold_broadened_fidelity
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from daas.compile_down import emit
from daas.schemas import WorkflowSpec
from daas.benchmarks.broadened_eval_scenarios import (
    SCENARIOS,
    Scenario,
    score_scenario,
    scenarios_by_category,
)

FLASH_MODEL = "gemini-3.1-flash-lite-preview"
FLASH_IN = 0.10 / 1_000_000
FLASH_OUT = 0.40 / 1_000_000


def _post_gemini(url: str, body: dict, timeout: int = 45) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def run_baseline(scenario: Scenario, api_key: str) -> dict[str, Any]:
    body = {
        "contents": [{"role": "user", "parts": [{"text": scenario.prompt}]}],
        "tools": [{"functionDeclarations": [scenario.tool_spec]}],
        "toolConfig": {"functionCallingConfig": {"mode": "ANY"}},
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 1024},
    }
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{FLASH_MODEL}:generateContent?key={api_key}"
    )
    t0 = time.perf_counter()
    try:
        parsed = _post_gemini(url, body)
    except Exception as e:  # noqa: BLE001
        return {
            "tool_calls": [],
            "in_tok": 0,
            "out_tok": 0,
            "elapsed_s": round(time.perf_counter() - t0, 2),
            "error": f"{type(e).__name__}: {e}",
        }
    elapsed = time.perf_counter() - t0
    parts = (
        ((parsed.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    )
    tool_calls: list[dict[str, Any]] = []
    for p in parts:
        fc = (p or {}).get("functionCall")
        if fc:
            tool_calls.append(
                {"name": str(fc.get("name", "")), "arguments": fc.get("args") or {}}
            )
    usage = parsed.get("usageMetadata") or {}
    return {
        "tool_calls": tool_calls,
        "in_tok": int(usage.get("promptTokenCount", 0) or 0),
        "out_tok": int(usage.get("candidatesTokenCount", 0) or 0),
        "elapsed_s": round(elapsed, 2),
    }


_SCAFFOLD_MODULES = ("runner", "tools", "schemas", "prompts", "state",
                     "handoffs", "orchestrator", "graph", "agent",
                     "workers", "eval", "observability", "mcp_server",
                     "state_store", "server")


def _import_from(path: Path, module: str) -> Any:
    # Clear EVERY scaffold module before each scenario — emitter
    # produces modules with identical names across scenarios, so
    # scaffold #2+ was picking up scaffold #1's cached tools.py.
    for k in list(sys.modules.keys()):
        base = k.split(".", 1)[0]
        if base in _SCAFFOLD_MODULES:
            del sys.modules[k]
    sys.path.insert(0, str(path))
    try:
        return importlib.import_module(module)
    finally:
        try:
            sys.path.remove(str(path))
        except ValueError:
            pass


def run_scaffold(scenario: Scenario, api_key: str) -> dict[str, Any]:
    tool = {
        "name": scenario.tool_spec["name"],
        "purpose": scenario.tool_spec.get("description", ""),
        "input_schema": scenario.tool_spec.get("parameters", {}) or {},
    }
    spec = WorkflowSpec(
        source_trace_id=scenario.id,
        executor_model=FLASH_MODEL,
        orchestrator_system_prompt=(
            f"You answer the user's request by calling the declared "
            f"tool. Category: {scenario.category}."
        ),
        tools=[tool],
    )
    bundle = emit("tool_first_chain", spec)
    tmp = Path(tempfile.mkdtemp(prefix=f"attrition_{scenario.id}_"))
    for f in bundle.files:
        target = tmp / f.path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f.content, encoding="utf-8")

    prev_key = os.environ.get("GEMINI_API_KEY")
    prev_mode = os.environ.get("CONNECTOR_MODE")
    os.environ["GEMINI_API_KEY"] = api_key
    os.environ["CONNECTOR_MODE"] = "mock"

    t0 = time.perf_counter()
    tool_calls: list[dict[str, Any]] = []
    in_tok = out_tok = 0
    error = ""
    try:
        runner_mod = _import_from(tmp, "runner")
        schemas_mod = _import_from(tmp, "schemas")
        result = runner_mod.run(schemas_mod.ChainInput(query=scenario.prompt))
        # ChainOutput exposes the tool-call list as `tool_calls`; older
        # harness code looked at `tool_calls_log` (the internal var)
        # and got [] — that was the apparent "regression".
        raw_calls = (
            getattr(result, "tool_calls", None)
            or getattr(result, "tool_calls_log", None)
            or []
        )
        for entry in raw_calls:
            if isinstance(entry, dict):
                tool_calls.append(
                    {
                        "name": str(
                            entry.get("name") or entry.get("tool") or ""
                        ),
                        "arguments": entry.get("arguments")
                        or entry.get("args")
                        or {},
                    }
                )
        in_tok = int(getattr(result, "input_tokens", 0) or 0)
        out_tok = int(getattr(result, "output_tokens", 0) or 0)
    except Exception as e:  # noqa: BLE001
        error = f"{type(e).__name__}: {e}"
    elapsed = time.perf_counter() - t0

    if prev_key is None:
        os.environ.pop("GEMINI_API_KEY", None)
    else:
        os.environ["GEMINI_API_KEY"] = prev_key
    if prev_mode is None:
        os.environ.pop("CONNECTOR_MODE", None)
    else:
        os.environ["CONNECTOR_MODE"] = prev_mode

    return {
        "tool_calls": tool_calls,
        "in_tok": in_tok,
        "out_tok": out_tok,
        "elapsed_s": round(elapsed, 2),
        "error": error,
    }


@dataclass
class ScenarioResult:
    scenario_id: str
    category: str
    condition: str
    passed: bool
    reason: str
    tool_calls: list[dict[str, Any]]
    in_tok: int
    out_tok: int
    elapsed_s: float
    error: str = ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-key", default=os.environ.get("GEMINI_API_KEY", ""))
    ap.add_argument(
        "--out",
        default="daas/results/scaffold_broadened_fidelity.json",
    )
    ap.add_argument(
        "--conditions",
        default="baseline,tool_first_chain",
    )
    args = ap.parse_args()

    if not args.api_key:
        print("[ERR] no GEMINI_API_KEY", file=sys.stderr)
        return 2

    conditions = [c.strip() for c in args.conditions.split(",") if c.strip()]
    runners = {
        "baseline": run_baseline,
        "tool_first_chain": run_scaffold,
    }

    print(f"=== scenarios: {len(SCENARIOS)} across {len(scenarios_by_category())} categories ===")
    for cat, items in scenarios_by_category().items():
        print(f"  {cat}: {len(items)}")

    results: list[ScenarioResult] = []
    for cond in conditions:
        fn = runners.get(cond)
        if not fn:
            print(f"[SKIP] unknown: {cond}")
            continue
        print(f"\n--- condition: {cond} ---")
        for sc in SCENARIOS:
            r = fn(sc, args.api_key)
            passed, reason = score_scenario(sc, r["tool_calls"])
            results.append(
                ScenarioResult(
                    scenario_id=sc.id,
                    category=sc.category,
                    condition=cond,
                    passed=passed,
                    reason=reason,
                    tool_calls=r["tool_calls"],
                    in_tok=r.get("in_tok", 0),
                    out_tok=r.get("out_tok", 0),
                    elapsed_s=r.get("elapsed_s", 0.0),
                    error=r.get("error", ""),
                )
            )
            mark = "[OK]" if passed else "[X] "
            print(
                f"  {mark} {sc.id:<20} {sc.category:<8} "
                f"calls={len(r['tool_calls'])} tok={r.get('in_tok', 0) + r.get('out_tok', 0):>5} "
                f"reason={reason[:50]!r}"
            )

    # Aggregate
    by_cond_cat: dict[tuple[str, str], dict[str, int]] = {}
    for r in results:
        key = (r.condition, r.category)
        bucket = by_cond_cat.setdefault(key, {"pass": 0, "total": 0, "in_tok": 0, "out_tok": 0})
        bucket["total"] += 1
        bucket["pass"] += 1 if r.passed else 0
        bucket["in_tok"] += r.in_tok
        bucket["out_tok"] += r.out_tok

    print("\n=== PER-CATEGORY RESULTS ===")
    print(f"{'condition':<22} {'category':<10} {'pass':<8} {'rate':<8} {'tok':<8} {'$':<10}")
    print("-" * 80)
    for (cond, cat), b in sorted(by_cond_cat.items()):
        rate = 100 * b["pass"] / max(1, b["total"])
        cost = b["in_tok"] * FLASH_IN + b["out_tok"] * FLASH_OUT
        print(
            f"{cond:<22} {cat:<10} {b['pass']}/{b['total']:<6} "
            f"{rate:>5.1f}%   {b['in_tok'] + b['out_tok']:<8} ${cost:<9.5f}"
        )

    # Overall per-condition
    print("\n=== OVERALL PER-CONDITION ===")
    for cond in conditions:
        subset = [r for r in results if r.condition == cond]
        p = sum(1 for r in subset if r.passed)
        n = len(subset)
        rate = 100 * p / max(1, n)
        tok = sum(r.in_tok + r.out_tok for r in subset)
        cost = sum(r.in_tok * FLASH_IN + r.out_tok * FLASH_OUT for r in subset)
        print(
            f"{cond:<22} {p}/{n}  {rate:>5.1f}%  {tok} tok  ${cost:.5f}"
        )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "scenarios": len(SCENARIOS),
                "conditions": conditions,
                "results": [asdict(r) for r in results],
                "per_category": {
                    f"{c[0]}/{c[1]}": {
                        **b,
                        "pass_rate": round(
                            100 * b["pass"] / max(1, b["total"]), 1
                        ),
                    }
                    for c, b in by_cond_cat.items()
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\n[DONE] {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
