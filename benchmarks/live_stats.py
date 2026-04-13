#!/usr/bin/env python3
"""Pull REAL measured stats from attrition retention API.

Fetches actual pipeline run packets and computes aggregate stats
from measured Gemini token usage. No estimates, no fakes.

Usage:
    python live_stats.py                    # print stats table
    python live_stats.py --json             # JSON output for API/frontend
    python live_stats.py --json stats.json  # write to file
"""

import argparse
import json
import sys
import urllib.request
from typing import Any

ATTRITION_URL = "https://attrition-7xtb75zi5q-uc.a.run.app"


def fetch_packets(base_url: str = ATTRITION_URL) -> list[dict[str, Any]]:
    """Fetch all retention packets from attrition API."""
    url = f"{base_url}/api/retention/packets"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
    # API returns list or {packets: [...]} or {items: [...]}
    if isinstance(data, list):
        return data
    return data.get("packets", data.get("items", []))


def compute_stats(packets: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute aggregate stats from real measured packet data."""
    runs_with_cost: list[dict[str, Any]] = []
    runs_without_cost: list[dict[str, Any]] = []
    all_runs: list[dict[str, Any]] = []

    for pkt in packets:
        d = pkt.get("data", {})
        if not d:
            continue

        run = {
            "query": d.get("query", "?"),
            "confidence": d.get("confidence"),
            "sourceCount": d.get("sourceCount", 0),
            "durationMs": d.get("durationMs", 0),
            "traceSteps": d.get("traceSteps", 0),
        }

        token_usage = d.get("tokenUsage")
        real_cost = d.get("realCost")

        if token_usage and real_cost:
            run["inputTokens"] = token_usage.get("inputTokens", 0)
            run["outputTokens"] = token_usage.get("outputTokens", 0)
            run["totalTokens"] = token_usage.get("totalTokens", 0)
            run["model"] = token_usage.get("model", "unknown")
            run["totalCostUsd"] = real_cost.get("totalCostUsd", 0)
            run["measured"] = True
            runs_with_cost.append(run)
        else:
            run["measured"] = False
            runs_without_cost.append(run)

        all_runs.append(run)

    # Compute aggregates from MEASURED runs only
    measured = runs_with_cost
    n = len(measured)

    if n == 0:
        return {
            "total_packets": len(packets),
            "measured_runs": 0,
            "unmeasured_runs": len(runs_without_cost),
            "message": "No measured runs yet. Run queries through the pipeline to generate data.",
        }

    avg_tokens = sum(r["totalTokens"] for r in measured) / n
    avg_cost = sum(r["totalCostUsd"] for r in measured) / n
    avg_input = sum(r["inputTokens"] for r in measured) / n
    avg_output = sum(r["outputTokens"] for r in measured) / n
    avg_duration = sum(r["durationMs"] for r in measured) / n
    avg_confidence = sum(r.get("confidence", 0) or 0 for r in measured) / n
    avg_sources = sum(r["sourceCount"] for r in measured) / n
    total_cost = sum(r["totalCostUsd"] for r in measured)

    models_used = list(set(r.get("model", "unknown") for r in measured))

    return {
        "total_packets": len(packets),
        "measured_runs": n,
        "unmeasured_runs": len(runs_without_cost),
        "avg_tokens_per_query": round(avg_tokens),
        "avg_input_tokens": round(avg_input),
        "avg_output_tokens": round(avg_output),
        "avg_cost_per_query_usd": round(avg_cost, 6),
        "total_cost_usd": round(total_cost, 6),
        "avg_duration_ms": round(avg_duration),
        "avg_confidence_pct": round(avg_confidence, 1),
        "avg_sources_per_query": round(avg_sources, 1),
        "models_used": models_used,
        "cost_per_1k_queries_usd": round(avg_cost * 1000, 2),
        "runs": [
            {
                "query": r["query"][:80],
                "tokens": r["totalTokens"],
                "cost_usd": round(r["totalCostUsd"], 6),
                "confidence": r.get("confidence"),
                "sources": r["sourceCount"],
                "duration_ms": r["durationMs"],
                "model": r.get("model", "?"),
            }
            for r in measured
        ],
    }


def format_table(stats: dict[str, Any]) -> str:
    """Format stats as a human-readable table."""
    lines = []
    lines.append("=" * 60)
    lines.append("ATTRITION.SH — REAL MEASURED PIPELINE STATS")
    lines.append("=" * 60)
    lines.append(f"Total packets:        {stats.get('total_packets', 0)}")
    lines.append(f"Measured runs:        {stats.get('measured_runs', 0)}")
    lines.append(f"Unmeasured runs:      {stats.get('unmeasured_runs', 0)}")
    lines.append("")

    if stats.get("measured_runs", 0) == 0:
        lines.append(stats.get("message", "No data"))
        return "\n".join(lines)

    lines.append(f"Avg tokens/query:     {stats['avg_tokens_per_query']:,}")
    lines.append(f"  Input tokens:       {stats['avg_input_tokens']:,}")
    lines.append(f"  Output tokens:      {stats['avg_output_tokens']:,}")
    lines.append(f"Avg cost/query:       ${stats['avg_cost_per_query_usd']:.6f}")
    lines.append(f"Cost per 1K queries:  ${stats['cost_per_1k_queries_usd']:.2f}")
    lines.append(f"Total cost (all runs):${stats['total_cost_usd']:.6f}")
    lines.append(f"Avg duration:         {stats['avg_duration_ms']:,}ms")
    lines.append(f"Avg confidence:       {stats['avg_confidence_pct']}%")
    lines.append(f"Avg sources/query:    {stats['avg_sources_per_query']}")
    lines.append(f"Models:               {', '.join(stats['models_used'])}")
    lines.append("")
    lines.append("-" * 60)
    lines.append("PER-QUERY BREAKDOWN")
    lines.append("-" * 60)

    for run in stats.get("runs", []):
        lines.append(
            f"  {run['query'][:50]:50s} "
            f"{run['tokens']:>5} tok  "
            f"${run['cost_usd']:.6f}  "
            f"{run['confidence'] or '?':>3}%  "
            f"{run['duration_ms']:>5}ms"
        )

    lines.append("=" * 60)
    lines.append("All numbers are MEASURED from real Gemini API usageMetadata.")
    lines.append("No estimates. No fakes. No duration-based approximations.")
    lines.append("=" * 60)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Pull real measured stats from attrition")
    parser.add_argument("--json", nargs="?", const="-", help="JSON output (- for stdout, or filename)")
    parser.add_argument("--url", default=ATTRITION_URL, help="Attrition backend URL")
    args = parser.parse_args()

    try:
        packets = fetch_packets(args.url)
    except Exception as e:
        print(f"Error fetching packets: {e}", file=sys.stderr)
        sys.exit(1)

    stats = compute_stats(packets)

    if args.json is not None:
        output = json.dumps(stats, indent=2)
        if args.json == "-":
            print(output)
        else:
            from pathlib import Path
            Path(args.json).write_text(output, encoding="utf-8")
            print(f"Written to {args.json}")
    else:
        print(format_table(stats))


if __name__ == "__main__":
    main()
