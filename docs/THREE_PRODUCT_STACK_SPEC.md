# Three-Product Stack Spec

## The Stack

```
NodeBench AI   = flagship user surface (create, read, act on reports)
nodebench-mcp  = embedded workflow lane (Claude Code / Codex / Cursor)
Attrition.sh   = measured replay / optimization lane (capture, compress, replay, prove)
```

All three produce or act on ONE shared object: the canonical workflow artifact.

## Attrition's Job (and ONLY job)

```
capture → measure → compress → replay → prove savings
```

Not: notes app, research UI, giant MCP platform, CRM, dashboard suite.

**One-line**: "Attrition wraps a strong run, figures out what mattered, trims the waste, and helps replay similar work later with lower cost and clearer proof."

## What Users See (5 things, nothing else)

1. The workflow name
2. The final report artifact
3. Actual latency
4. Actual cost
5. Replay savings

Example:
```
Workflow: company diligence
Run 1: 8m 12s, $1.84
Run 2 (replay): 2m 19s, $0.27
Savings: 72% time, 85% cost
Output: saved report + sources + follow-up actions
```

## Required Metrics

### Per run
- startup_ms
- time_to_first_output_ms
- workflow_completion_ms
- tool_calls_count
- sources_count
- actual_provider_cost_usd
- artifact_generated_bool

### Per replay
- replay_latency_ms
- replay_cost_usd
- delta_vs_original_time
- delta_vs_original_cost
- artifact_similarity

### Product
- runs_wrapped
- runs_replayed
- median_time_saved
- median_cost_saved

## Initial Wedge

Repeated research and diligence workflows (aligned with NodeBench AI):
- Company profile
- Founder profile
- Market report
- Social thesis review

## Shipping Modes

1. **Sidecar CLI**: `attrition run claude ...` / `attrition replay <id>` / `attrition compare <a> <b>`
2. **Hooks integration**: SessionStart/PostToolUse/SessionEnd capture
3. **Tiny MCP surface**: capture_workflow, replay_workflow, compare_runs, export_report (4 tools, not 12)

## What NOT To Do

- Do not make Attrition a third flagship destination
- Do not lead with compression/distillation/trajectory jargon
- Do not build giant dashboards before one real loop works
- Do not add more MCP tools — reduce to 4
- Do not compete with NodeBench AI for user attention

## How To Talk About It

**Simple**: "NodeBench turns messy inputs into saved reports. Attrition shows what the workflow actually cost and how much cheaper the next run can be."

**Stronger**: "Most agent workflows are expensive, fuzzy, and hard to prove. Attrition wraps the workflow, captures the real runtime, and helps replay strong runs so you can show measured savings instead of vague claims."
