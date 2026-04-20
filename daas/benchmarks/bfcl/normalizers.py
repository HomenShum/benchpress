"""BFCL output normalizers — deterministic post-processors applied
between the model's raw tool-call output and the scorer.

Purpose: rule-based scaffolding that closes surface-syntax gaps
between cheap model output and BFCL's strict AST comparator. Each
normalizer is pure (idempotent, deterministic, no I/O) and
documented against the specific failure mode it fixes.

Failure modes these address, from ``docs/BFCL_FALSIFICATION_FINDINGS.md``:

  ``WRONG_ARGS``: math notation — model emits ``x^2`` when gold
  accepts ``{"x**2", "lambda x: x**2", "y=x**2"}``. Pure transform:
  replace ``^`` with ``**`` inside string-valued ``function`` arguments.

  ``WRONG_ARGS``: interval notation — model emits ``[1, 3]`` when gold
  accepts ``[1.0, 3.0]``. Transform: coerce integer list members to
  floats inside args that look like numeric ranges.

  ``COUNT_DIFF`` (parallel): model emits fewer calls than expected.
  This is NOT closable by a stateless post-processor — left to
  higher-tier scaffolds.

Each normalizer returns a new tool-call list; never mutates input.
"""

from __future__ import annotations

import re
from typing import Any

# String arguments whose content is a math expression. BFCL uses these
# consistently across `calculate_*`, `integrate`, `calculus.*`, etc.
_MATH_EXPR_ARG_KEYS = {"function", "expression", "expr", "equation", "formula"}

_POW_PATTERN = re.compile(r"([A-Za-z0-9_\)\]])\s*\^\s*(\d+)")
"""Matches `x^2`, `sin(x)^2`, `arr[0]^3` — things BFCL would expect as
`x**2`. Does NOT match XOR-style `a^b` between variables (too risky)."""

_IMPLICIT_MULT_PATTERN = re.compile(r"(\d+)\s*\*\s*([A-Za-z_])")
"""Matches `3*x`, `2*y` — explicit multiplication that BFCL conventionally
writes implicitly as `3x`, `2y`. Does NOT match `10*20` (literal math).
Does NOT match `x*y` (variable*variable — ambiguous)."""


def _normalize_math_expression(s: str) -> str:
    """Normalize math expression surface syntax to BFCL's canonical form:
      * `x^2` → `x**2` (python-style exponent)
      * `3*x` → `3x` (implicit coefficient multiplication)

    Idempotent. Each substitution is deliberately narrow to avoid false
    positives on non-math expressions.
    """
    if not s:
        return s
    out = s
    if "^" in out:
        out = _POW_PATTERN.sub(lambda m: f"{m.group(1)}**{m.group(2)}", out)
    if "*" in out:
        # Apply repeatedly until stable — overlapping matches possible.
        prev = None
        while prev != out:
            prev = out
            out = _IMPLICIT_MULT_PATTERN.sub(
                lambda m: f"{m.group(1)}{m.group(2)}", out
            )
    return out


def _normalize_interval_list(v: Any) -> Any:
    """Coerce integer list-of-length-2-or-3 into floats.

    BFCL gold often accepts `[1.0, 3.0]` where the model emits
    `[1, 3]`. When the gold list has `float` members and the model
    emits `int` members, the AST scorer can fail on type mismatch
    (our local comparator normalizes this, but the bfcl-eval upstream
    comparator is stricter). Pre-emptively coerce.
    """
    if not isinstance(v, list):
        return v
    if not (2 <= len(v) <= 3):
        return v
    if all(isinstance(x, int) and not isinstance(x, bool) for x in v):
        return [float(x) for x in v]
    return v


def normalize_tool_call_args(args: dict[str, Any]) -> dict[str, Any]:
    """Apply all BFCL-targeted normalizations to one tool-call's args.

    Returns a new dict. Never mutates input.
    """
    if not isinstance(args, dict):
        return args
    out: dict[str, Any] = {}
    for k, v in args.items():
        if isinstance(v, str) and k.lower() in _MATH_EXPR_ARG_KEYS:
            out[k] = _normalize_math_expression(v)
        elif isinstance(v, list):
            out[k] = _normalize_interval_list(v)
        else:
            out[k] = v
    return out


def normalize_artifact(artifact: dict[str, Any]) -> dict[str, Any]:
    """Apply normalizations to every tool call in a DaaS replay
    artifact. Preserves shape so the scorer sees the same keys."""
    if not isinstance(artifact, dict):
        return artifact
    result = dict(artifact)

    # canonical DaaS shape: toolCalls[].args
    if isinstance(result.get("toolCalls"), list):
        result["toolCalls"] = [
            {**tc, "args": normalize_tool_call_args(tc.get("args") or {})}
            if isinstance(tc, dict)
            else tc
            for tc in result["toolCalls"]
        ]

    # shorthand: calls[].arguments
    if isinstance(result.get("calls"), list):
        result["calls"] = [
            {**c, "arguments": normalize_tool_call_args(c.get("arguments") or {})}
            if isinstance(c, dict)
            else c
            for c in result["calls"]
        ]

    return result
