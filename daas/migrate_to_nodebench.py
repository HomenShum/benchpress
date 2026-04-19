"""Migrate the 3 existing DaaS results into NodeBench's Convex deployment.

Uses the public Convex HTTP client to call ingestTrace, storeWorkflowSpec,
storeReplay, and storeJudgment against the NodeBench prod deployment.

Prereqs: convex-py installed (`pip install convex`)
Config: NEXT_PUBLIC_CONVEX_URL read from nodebench-ai/.env.local
"""

import json
import os
import sys
from pathlib import Path

# Pick up NodeBench prod URL
ENV = Path("D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/nodebench-ai/.env.local")
CONVEX_URL = None
if ENV.exists():
    for line in ENV.read_text().splitlines():
        if line.startswith("VITE_CONVEX_URL="):
            CONVEX_URL = line.split("=", 1)[1].strip().strip('"')
            break

if not CONVEX_URL:
    print("ERROR: VITE_CONVEX_URL not found in nodebench-ai/.env.local", file=sys.stderr)
    sys.exit(1)

print(f"Using Convex deployment: {CONVEX_URL}")

try:
    from convex import ConvexClient
except ImportError:
    print("Installing convex...")
    os.system(f"{sys.executable} -m pip install convex --quiet")
    from convex import ConvexClient

RESULTS = Path(__file__).parent / "results"

traces = json.loads((RESULTS / "canonical_traces.json").read_text(encoding="utf-8"))
specs = json.loads((RESULTS / "workflow_specs.json").read_text(encoding="utf-8"))
replays = json.loads((RESULTS / "replays.json").read_text(encoding="utf-8"))
judgments = json.loads((RESULTS / "judgments.json").read_text(encoding="utf-8"))

print(f"Loaded {len(traces)} traces, {len(specs)} specs, {len(replays)} replays, {len(judgments)} judgments")

client = ConvexClient(CONVEX_URL)

# Index specs and judgments by source trace / replay
specs_by_trace = {s["source_trace_id"]: s for s in specs}
replays_by_trace = {r["trace_id"]: r for r in replays}
judgments_by_trace = {j["original_trace_id"]: j for j in judgments}

for trace in traces:
    sid = trace["session_id"]
    print(f"\n=== {sid} ===")

    # 1. Ingest trace (omit None-valued optionals — Convex wants undefined, not null)
    ingest_args = {
        "sessionId": sid,
        "sourceModel": trace["source_model"],
        "sourceSystem": "floorai-ingest-mvp",
        "query": trace["query"],
        "finalAnswer": trace["final_answer"],
        "totalCostUsd": float(trace["total_cost_usd"]),
        "totalTokens": int(trace["total_tokens"]),
        "durationMs": int(trace["duration_ms"]),
        "repoContextJson": json.dumps(trace.get("repo_context") or {}),
        "stepsJson": json.dumps(trace.get("steps") or []),
    }
    if trace.get("advisor_model"):
        ingest_args["advisorModel"] = trace["advisor_model"]
    trace_id = client.mutation("domains/daas/mutations:ingestTrace", ingest_args)
    print(f"  [ingest] trace_id={trace_id}")

    # 2. Store spec
    spec = specs_by_trace.get(sid)
    if spec:
        spec_args = {
            "sourceTraceId": sid,
            "executorModel": spec.get("executor_model", "gemini-3.1-flash-lite-preview"),
            "targetSdk": spec.get("target_sdk", "google-genai"),
            "workerCount": len(spec.get("workers", [])),
            "toolCount": len(spec.get("tools", [])),
            "handoffCount": len(spec.get("handoffs", [])),
            "specJson": json.dumps(spec),
            "distillCostUsd": 0.0,
            "distillTokens": 0,
        }
        if spec.get("advisor_model"):
            spec_args["advisorModel"] = spec["advisor_model"]
        spec_id = client.mutation("domains/daas/mutations:storeWorkflowSpec", spec_args)
        print(f"  [spec] spec_id={spec_id} workers={len(spec.get('workers', []))}")
    else:
        spec_id = None
        print(f"  [spec] MISSING")

    # 3. Store replay
    replay = replays_by_trace.get(sid)
    if replay:
        replay_args = {
            "traceId": sid,
            "executorModel": spec.get("executor_model", "gemini-3.1-flash-lite-preview") if spec else "unknown",
            "replayAnswer": replay["replay_answer"],
            "originalAnswer": replay["original_answer"],
            "originalCostUsd": float(replay["original_cost_usd"]),
            "originalTokens": int(replay["original_tokens"]),
            "replayCostUsd": float(replay["replay_cost_usd"]),
            "replayTokens": int(replay["replay_tokens"]),
            "workersDispatched": replay.get("workers_dispatched", []),
            "toolCallsJson": json.dumps(replay.get("tool_calls", [])),
            "connectorMode": "mock",
            "durationMs": 0,
        }
        if spec_id:
            replay_args["specId"] = spec_id
        replay_id = client.mutation("domains/daas/mutations:storeReplay", replay_args)
        print(f"  [replay] replay_id={replay_id} cost=${replay['replay_cost_usd']:.6f}")
    else:
        replay_id = None
        print(f"  [replay] MISSING")

    # 4. Store judgment
    judgment = judgments_by_trace.get(sid)
    if judgment and replay_id:
        judgment_id = client.mutation("domains/daas/mutations:storeJudgment", {
            "traceId": sid,
            "replayId": replay_id,
            "outputSimilarity": float(judgment["output_similarity"]),
            "costDeltaPct": float(judgment["cost_delta_pct"]),
            "toolParity": float(judgment.get("tool_parity", 0)),
            "qualityScore": float(judgment.get("quality_score", 0)),
            "verdict": judgment.get("verdict", "fail"),
            "detailsJson": judgment.get("details", "{}"),
        })
        print(f"  [judgment] judgment_id={judgment_id} verdict={judgment['verdict']} sim={judgment['output_similarity']}")
    else:
        print(f"  [judgment] MISSING (have_judgment={bool(judgment)} have_replay={bool(replay_id)})")

print("\nMigration complete.")
print("Verify via:")
print("  npx convex run domains/daas/queries:getAggregateStats")
print("  npx convex run domains/daas/queries:listRuns '{}'")
