# Advisor Protocol — attrition.sh

## Problem

The Claude Advisor pattern (Sonnet executor + Opus advisor) trades cost for quality. But without measurement:
- You don't know if escalation was worth the Opus cost
- You can't compare sessions with vs without advisor
- You can't detect when the executor SHOULD have escalated but didn't
- You can't prove ROI to stakeholders

attrition.sh makes the advisor pattern measurable.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Agent Harness (Claude Code, Cursor, custom)                 │
│                                                              │
│  ┌─────────────────┐    ┌──────────────────┐                │
│  │ Executor (Sonnet)│───▶│ Advisor (Opus)   │                │
│  │ routine tasks    │◀───│ complex reasoning│                │
│  └────────┬────────┘    └────────┬─────────┘                │
│           │                      │                           │
│           ▼                      ▼                           │
│  ┌─────────────────────────────────────────┐                │
│  │ attrition SDK — advisor_wrapper.py      │                │
│  │ Tags each LLM call: executor | advisor  │                │
│  │ Detects escalation triggers             │                │
│  │ Tracks real token costs per model tier  │                │
│  └────────────────────┬────────────────────┘                │
└───────────────────────┼──────────────────────────────────────┘
                        │ push-packet
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  attrition.sh backend (Rust + Cloud Run)                     │
│                                                              │
│  POST /api/retention/push-packet                             │
│    type: "advisor.decision" | "advisor.session"              │
│                                                              │
│  GET /api/advisor/stats                                      │
│    Aggregated: cost breakdown, escalation rate,              │
│    advisor effectiveness, model comparison                   │
│                                                              │
│  GET /api/advisor/sessions                                   │
│    Per-session: timeline of executor ↔ advisor handoffs      │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  attrition.sh frontend                                       │
│                                                              │
│  /advisor — Dashboard                                        │
│    • Cost split: Sonnet tokens vs Opus tokens                │
│    • Escalation rate over time                               │
│    • Advisor effectiveness: did escalation improve outcome?  │
│    • Session comparison: with vs without advisor             │
└──────────────────────────────────────────────────────────────┘
```

## Packet Types

### advisor.decision — One per advisor invocation

```json
{
  "type": "advisor.decision",
  "subject": "Debug real-time sync issue",
  "summary": "Executor failed 2x, escalated to Opus. Advisor identified race condition.",
  "data": {
    "session_id": "sess_abc123",
    "decision_id": "dec_001",
    "timestamp": "2026-04-15T10:30:00Z",

    "trigger": "executor_failure",
    "trigger_detail": "Sonnet produced incorrect fix for WebSocket reconnect",

    "executor": {
      "model": "claude-sonnet-4-6",
      "tokens_before_escalation": 12400,
      "cost_before_escalation_usd": 0.0186,
      "attempts": 2,
      "last_error": "TypeError: Cannot read property 'readyState' of null"
    },

    "advisor": {
      "model": "claude-opus-4-6",
      "input_tokens": 3200,
      "output_tokens": 1800,
      "total_tokens": 5000,
      "cost_usd": 0.183,
      "latency_ms": 4200,
      "advice_type": "diagnosis",
      "advice_summary": "Race condition: WebSocket.onclose fires before state cleanup"
    },

    "outcome": {
      "executor_applied": true,
      "additional_executor_tokens": 4200,
      "additional_executor_cost_usd": 0.0063,
      "task_completed": true,
      "user_corrections_after": 0
    },

    "cost_analysis": {
      "total_with_advisor_usd": 0.2079,
      "estimated_without_advisor_usd": 0.45,
      "savings_pct": 53.8,
      "advisor_cost_share_pct": 88.0,
      "was_worth_it": true
    }
  }
}
```

### advisor.session — One per completed session

```json
{
  "type": "advisor.session",
  "subject": "Session: add dark mode toggle",
  "summary": "3 escalations, 65% cost from advisor, task completed first-pass",
  "data": {
    "session_id": "sess_abc123",
    "started_at": "2026-04-15T10:00:00Z",
    "ended_at": "2026-04-15T10:45:00Z",
    "duration_ms": 2700000,

    "executor_model": "claude-sonnet-4-6",
    "advisor_model": "claude-opus-4-6",

    "executor_stats": {
      "total_tokens": 45000,
      "total_cost_usd": 0.0675,
      "calls": 28,
      "self_sufficient_pct": 89.3
    },

    "advisor_stats": {
      "total_tokens": 15000,
      "total_cost_usd": 0.915,
      "calls": 3,
      "escalation_triggers": ["executor_failure", "complexity_threshold", "user_nudge"],
      "advice_types": ["diagnosis", "architecture", "code_review"]
    },

    "combined": {
      "total_cost_usd": 0.9825,
      "advisor_cost_share_pct": 93.1,
      "escalation_rate_pct": 10.7,
      "user_corrections": 0,
      "task_completed": true,
      "first_pass_success": true
    },

    "comparison": {
      "opus_only_estimated_tokens": 52000,
      "opus_only_estimated_cost_usd": 4.68,
      "savings_vs_opus_only_pct": 79.0
    }
  }
}
```

## Escalation Triggers

| Trigger | Detection Method |
|---------|-----------------|
| `executor_failure` | Executor produces error, user says "that's wrong" |
| `complexity_threshold` | Task exceeds N tokens without progress |
| `user_nudge` | User explicitly says "ask Opus" / "get advisor" |
| `confidence_low` | Executor self-reports low confidence |
| `retry_loop` | Same tool called 3+ times with similar args |
| `subagent_invoked` | Claude Code spawns Opus subagent |

## SDK Usage

```python
import attrition

# Configure advisor tracking
attrition.configure(
    providers=["anthropic"],
    advisor_mode={
        "executor_model": "claude-sonnet-4-6",
        "advisor_model": "claude-opus-4-6",
        "auto_detect_escalation": True,
        "escalation_token_threshold": 20000,
    }
)

# Track is automatic after configure()
attrition.track(providers=["anthropic"])
# All Anthropic calls are now tagged as executor or advisor
# Escalation events are auto-detected and pushed to attrition backend
```

## Claude Plugin Integration

The `.claude-plugin/hooks.json` already has `PostToolUse` and `Stop` hooks. For advisor mode:

1. `SubagentStop` hook detects when Opus advisor completes
2. `Stop` hook computes session-level advisor stats
3. Both push advisor packets to attrition backend

## API Endpoints

### GET /api/advisor/stats
Returns aggregate advisor mode statistics across all sessions.

### GET /api/advisor/sessions
Returns per-session advisor summaries.

### GET /api/advisor/sessions/:id/decisions
Returns individual escalation decisions for a session.

## Key Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **Escalation Rate** | % of LLM calls that go to advisor | 5-15% |
| **Advisor Cost Share** | % of total cost from advisor model | < 40% |
| **Savings vs Opus-Only** | Cost reduction from advisor pattern | > 60% |
| **Advisor Effectiveness** | % of escalations that resolved the issue | > 80% |
| **Missed Escalations** | Tasks where executor failed and DIDN'T escalate | < 5% |
| **First-Pass Success** | % of sessions completed without user corrections | > 85% |

## Pricing Reference (Real, Not Estimated)

| Model | Input $/M | Output $/M | Source |
|-------|----------|-----------|--------|
| claude-opus-4-6 | $15.00 | $75.00 | Anthropic API pricing Apr 2026 |
| claude-sonnet-4-6 | $3.00 | $15.00 | Anthropic API pricing Apr 2026 |
| claude-haiku-4-5 | $0.80 | $4.00 | Anthropic API pricing Apr 2026 |
| gemini-3.1-flash-lite | $0.075 | $0.30 | Google AI pricing Apr 2026 |

All costs in attrition are MEASURED from real API usageMetadata, never estimated.
