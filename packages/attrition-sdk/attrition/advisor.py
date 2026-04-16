"""Advisor Mode tracking for attrition.

Instruments the Sonnet executor + Opus advisor pattern with real cost tracking.
Detects escalation events, measures advisor effectiveness, and pushes structured
packets to the attrition backend.

Usage:
    from attrition.advisor import AdvisorTracker

    tracker = AdvisorTracker(
        executor_model="claude-sonnet-4-6",
        advisor_model="claude-opus-4-6",
        endpoint="https://attrition-7xtb75zi5q-uc.a.run.app",
    )

    # Track an executor call
    tracker.log_executor_call(input_tokens=1200, output_tokens=400, tool="Edit", success=True)

    # Track an escalation to advisor
    tracker.log_advisor_call(
        trigger="executor_failure",
        input_tokens=3200,
        output_tokens=1800,
        advice_type="diagnosis",
        advice_summary="Race condition in WebSocket reconnect",
    )

    # End session and push summary
    tracker.end_session(task_completed=True, user_corrections=0)
"""

import json
import time
import urllib.request
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone

from attrition.storage import append_event

# ── Model pricing (USD per million tokens) ──────────────────────────────────

MODEL_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-6":   (15.0,  75.0),
    "claude-sonnet-4-6": (3.0,   15.0),
    "claude-haiku-4-5":  (0.8,   4.0),
    "gpt-4o":            (2.5,   10.0),
    "gpt-4o-mini":       (0.15,  0.6),
    "gemini-3.1-flash-lite-preview": (0.075, 0.30),
    "gemini-2.5-flash":  (0.15,  0.60),
}


def compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Compute real cost from token counts using published pricing."""
    inp_rate, out_rate = MODEL_PRICING.get(model, (3.0, 15.0))
    return (input_tokens / 1_000_000) * inp_rate + (output_tokens / 1_000_000) * out_rate


# ── Data classes ────────────────────────────────────────────────────────────

@dataclass
class ExecutorCall:
    input_tokens: int
    output_tokens: int
    cost_usd: float
    tool: str
    success: bool
    timestamp: str


@dataclass
class AdvisorCall:
    trigger: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    advice_type: str
    advice_summary: str
    latency_ms: int
    was_applied: bool
    timestamp: str


@dataclass
class SessionStats:
    executor_tokens: int = 0
    executor_cost: float = 0.0
    executor_calls: int = 0
    advisor_tokens: int = 0
    advisor_cost: float = 0.0
    advisor_calls: int = 0
    escalation_triggers: list = field(default_factory=list)
    advice_types: list = field(default_factory=list)


# ── Main tracker ────────────────────────────────────────────────────────────

class AdvisorTracker:
    """Track Sonnet executor + Opus advisor pattern with real cost measurement."""

    def __init__(
        self,
        executor_model: str = "claude-sonnet-4-6",
        advisor_model: str = "claude-opus-4-6",
        endpoint: Optional[str] = None,
        session_id: Optional[str] = None,
        auto_push: bool = True,
    ):
        self.executor_model = executor_model
        self.advisor_model = advisor_model
        self.endpoint = endpoint or "https://attrition-7xtb75zi5q-uc.a.run.app"
        self.session_id = session_id or f"sess_{int(time.time() * 1000) % 1_000_000_000:x}"
        self.auto_push = auto_push
        self.started_at = datetime.now(timezone.utc).isoformat()

        self._executor_calls: list[ExecutorCall] = []
        self._advisor_calls: list[AdvisorCall] = []
        self._stats = SessionStats()

    def log_executor_call(
        self,
        input_tokens: int,
        output_tokens: int,
        tool: str = "",
        success: bool = True,
    ) -> ExecutorCall:
        """Record an executor (Sonnet) LLM call."""
        cost = compute_cost(self.executor_model, input_tokens, output_tokens)
        call = ExecutorCall(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            tool=tool,
            success=success,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        self._executor_calls.append(call)
        self._stats.executor_tokens += input_tokens + output_tokens
        self._stats.executor_cost += cost
        self._stats.executor_calls += 1

        # Log to local JSONL
        append_event({
            "ts": call.timestamp,
            "type": "advisor.executor_call",
            "session_id": self.session_id,
            "model": self.executor_model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": round(cost, 8),
            "tool": tool,
            "success": success,
        })
        return call

    def log_advisor_call(
        self,
        trigger: str,
        input_tokens: int,
        output_tokens: int,
        advice_type: str = "general",
        advice_summary: str = "",
        latency_ms: int = 0,
        was_applied: bool = True,
    ) -> AdvisorCall:
        """Record an advisor (Opus) escalation call."""
        cost = compute_cost(self.advisor_model, input_tokens, output_tokens)
        call = AdvisorCall(
            trigger=trigger,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            advice_type=advice_type,
            advice_summary=advice_summary,
            latency_ms=latency_ms,
            was_applied=was_applied,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        self._advisor_calls.append(call)
        self._stats.advisor_tokens += input_tokens + output_tokens
        self._stats.advisor_cost += cost
        self._stats.advisor_calls += 1
        self._stats.escalation_triggers.append(trigger)
        self._stats.advice_types.append(advice_type)

        # Log to local JSONL
        append_event({
            "ts": call.timestamp,
            "type": "advisor.advisor_call",
            "session_id": self.session_id,
            "model": self.advisor_model,
            "trigger": trigger,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": round(cost, 8),
            "advice_type": advice_type,
            "advice_summary": advice_summary[:200],
            "was_applied": was_applied,
        })

        # Push decision packet to backend
        if self.auto_push:
            self._push_decision(call)

        return call

    def end_session(
        self,
        task_completed: bool = True,
        user_corrections: int = 0,
        subject: str = "",
    ) -> dict:
        """Finalize the session and push summary packet."""
        ended_at = datetime.now(timezone.utc).isoformat()
        s = self._stats
        combined_cost = s.executor_cost + s.advisor_cost
        total_calls = s.executor_calls + s.advisor_calls

        # Estimate Opus-only cost (all tokens at Opus pricing)
        total_tokens = s.executor_tokens + s.advisor_tokens
        opus_only = compute_cost("claude-opus-4-6", total_tokens // 2, total_tokens // 2)

        session_data = {
            "session_id": self.session_id,
            "started_at": self.started_at,
            "ended_at": ended_at,
            "duration_ms": int(
                (datetime.fromisoformat(ended_at) - datetime.fromisoformat(self.started_at)).total_seconds() * 1000
            ),
            "executor_model": self.executor_model,
            "advisor_model": self.advisor_model,
            "executor_stats": {
                "total_tokens": s.executor_tokens,
                "total_cost_usd": round(s.executor_cost, 8),
                "calls": s.executor_calls,
                "self_sufficient_pct": round(
                    (s.executor_calls / total_calls * 100) if total_calls > 0 else 100, 1
                ),
            },
            "advisor_stats": {
                "total_tokens": s.advisor_tokens,
                "total_cost_usd": round(s.advisor_cost, 8),
                "calls": s.advisor_calls,
                "escalation_triggers": list(set(s.escalation_triggers)),
                "advice_types": list(set(s.advice_types)),
            },
            "combined": {
                "total_cost_usd": round(combined_cost, 8),
                "advisor_cost_share_pct": round(
                    (s.advisor_cost / combined_cost * 100) if combined_cost > 0 else 0, 1
                ),
                "escalation_rate_pct": round(
                    (s.advisor_calls / total_calls * 100) if total_calls > 0 else 0, 1
                ),
                "user_corrections": user_corrections,
                "task_completed": task_completed,
                "first_pass_success": task_completed and user_corrections == 0,
            },
            "comparison": {
                "opus_only_estimated_tokens": total_tokens,
                "opus_only_estimated_cost_usd": round(opus_only, 4),
                "savings_vs_opus_only_pct": round(
                    ((opus_only - combined_cost) / opus_only * 100) if opus_only > 0 else 0, 1
                ),
            },
        }

        # Log to local JSONL
        append_event({
            "ts": ended_at,
            "type": "advisor.session_end",
            "session_id": self.session_id,
            **{k: v for k, v in session_data.items() if k != "session_id"},
        })

        # Push session packet to backend
        if self.auto_push:
            self._push_session(session_data, subject)

        return session_data

    # ── Push helpers ─────────────────────────────────────────────────────

    def _push_decision(self, call: AdvisorCall):
        """Push advisor.decision packet to attrition backend (fire-and-forget)."""
        try:
            packet = {
                "type": "advisor.decision",
                "subject": f"Escalation: {call.advice_type} ({call.trigger})",
                "summary": call.advice_summary[:200] or f"{call.trigger} -> {call.advice_type}",
                "data": {
                    "session_id": self.session_id,
                    "decision_id": f"dec_{int(time.time() * 1000) % 1_000_000:x}",
                    "timestamp": call.timestamp,
                    "trigger": call.trigger,
                    "advisor": {
                        "model": self.advisor_model,
                        "input_tokens": call.input_tokens,
                        "output_tokens": call.output_tokens,
                        "total_tokens": call.input_tokens + call.output_tokens,
                        "cost_usd": round(call.cost_usd, 8),
                        "latency_ms": call.latency_ms,
                        "advice_type": call.advice_type,
                        "advice_summary": call.advice_summary[:500],
                    },
                    "outcome": {
                        "executor_applied": call.was_applied,
                        "task_completed": False,  # Unknown at decision time
                    },
                },
            }
            self._push_packet(packet)
        except Exception:
            pass  # Never crash the host

    def _push_session(self, data: dict, subject: str):
        """Push advisor.session packet to attrition backend (fire-and-forget)."""
        try:
            s = self._stats
            cost_str = f"${data['combined']['total_cost_usd']:.4f}"
            esc = s.advisor_calls
            packet = {
                "type": "advisor.session",
                "subject": subject or f"Session: {self.session_id}",
                "summary": f"{esc} escalations, {data['combined']['advisor_cost_share_pct']}% advisor cost, "
                           f"total {cost_str}",
                "data": data,
            }
            self._push_packet(packet)
        except Exception:
            pass

    def _push_packet(self, packet: dict):
        """POST to /api/retention/push-packet."""
        try:
            body = json.dumps(packet).encode("utf-8")
            req = urllib.request.Request(
                f"{self.endpoint}/api/retention/push-packet",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception:
            pass  # Best-effort, never block the agent
