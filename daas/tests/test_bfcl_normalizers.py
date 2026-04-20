"""Tests for BFCL deterministic post-processors."""

from __future__ import annotations

from daas.benchmarks.bfcl.normalizers import (
    normalize_artifact,
    normalize_tool_call_args,
    _normalize_interval_list,
    _normalize_math_expression,
)


# ---------------------------------------------------------------------------
# _normalize_math_expression
# ---------------------------------------------------------------------------


def test_math_basic_caret_to_double_star() -> None:
    assert _normalize_math_expression("x^2") == "x**2"


def test_math_multiple_replacements() -> None:
    assert _normalize_math_expression("x^2 + y^3") == "x**2 + y**3"


def test_math_preserves_already_correct() -> None:
    # No `^` in input -> identity
    assert _normalize_math_expression("x**2") == "x**2"


def test_math_preserves_empty() -> None:
    assert _normalize_math_expression("") == ""


def test_math_handles_parenthesized_base() -> None:
    assert _normalize_math_expression("(x+1)^2") == "(x+1)**2"


def test_math_does_not_false_match_non_numeric_exponent() -> None:
    # `a^b` where `b` is a variable — don't touch (could be XOR in code)
    # Our regex requires `^<digit>`.
    assert _normalize_math_expression("a^b") == "a^b"


def test_math_idempotent() -> None:
    once = _normalize_math_expression("x^2 + y^3")
    twice = _normalize_math_expression(once)
    assert once == twice


def test_math_implicit_multiplication() -> None:
    # `3*x**2` should become `3x**2` to match BFCL gold form
    assert _normalize_math_expression("3*x**2") == "3x**2"
    assert _normalize_math_expression("2*x + 3") == "2x + 3"
    assert _normalize_math_expression("3*x**2 + 2*x - 1") == "3x**2 + 2x - 1"


def test_math_does_not_collapse_literal_mult() -> None:
    # `10*20` (number * number) must stay — it's arithmetic, not coefficient
    assert _normalize_math_expression("10*20") == "10*20"


def test_math_does_not_collapse_variable_mult() -> None:
    # `x*y` is ambiguous (could be coefficient*var or var*var); leave alone
    assert _normalize_math_expression("x*y") == "x*y"


def test_math_combined_pow_and_implicit_mult() -> None:
    # Both transformations applied
    assert _normalize_math_expression("3*x^2 + 2*x^3") == "3x**2 + 2x**3"


# ---------------------------------------------------------------------------
# _normalize_interval_list
# ---------------------------------------------------------------------------


def test_interval_int_pair_becomes_floats() -> None:
    assert _normalize_interval_list([1, 3]) == [1.0, 3.0]


def test_interval_int_triple_becomes_floats() -> None:
    assert _normalize_interval_list([0, 5, 10]) == [0.0, 5.0, 10.0]


def test_interval_mixed_types_preserved() -> None:
    assert _normalize_interval_list([1, 3.0]) == [1, 3.0]


def test_interval_long_list_preserved() -> None:
    # Not a 2-3 element range — don't touch
    assert _normalize_interval_list([1, 2, 3, 4]) == [1, 2, 3, 4]


def test_interval_non_list_preserved() -> None:
    assert _normalize_interval_list("foo") == "foo"
    assert _normalize_interval_list(42) == 42


# ---------------------------------------------------------------------------
# normalize_tool_call_args — keyed dispatch
# ---------------------------------------------------------------------------


def test_args_applies_math_normalization_only_on_math_keys() -> None:
    # `function` key → math normalization applied
    out = normalize_tool_call_args({"function": "x^2", "name": "do^stuff"})
    assert out["function"] == "x**2"
    # `name` is not in MATH_EXPR_ARG_KEYS — unchanged
    assert out["name"] == "do^stuff"


def test_args_applies_interval_normalization() -> None:
    out = normalize_tool_call_args({"interval": [1, 3]})
    assert out["interval"] == [1.0, 3.0]


def test_args_case_insensitive_key_match() -> None:
    # FUNCTION, Function, etc all match
    out = normalize_tool_call_args({"Function": "x^2", "FUNCTION": "y^3"})
    assert out["Function"] == "x**2"
    assert out["FUNCTION"] == "y**3"


def test_args_returns_new_dict_not_mutating_input() -> None:
    original = {"function": "x^2"}
    out = normalize_tool_call_args(original)
    assert original["function"] == "x^2"  # input preserved
    assert out["function"] == "x**2"


def test_args_non_dict_passthrough() -> None:
    # Defensive: ensure normalizer handles non-dict without raising
    assert normalize_tool_call_args("not a dict") == "not a dict"  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# normalize_artifact — full replay artifact
# ---------------------------------------------------------------------------


def test_artifact_canonical_daas_shape() -> None:
    art = {
        "toolCalls": [
            {"worker": "w", "tool": "integrate", "args": {"function": "x^3", "interval": [1, 3]}},
        ]
    }
    out = normalize_artifact(art)
    assert out["toolCalls"][0]["args"]["function"] == "x**3"
    assert out["toolCalls"][0]["args"]["interval"] == [1.0, 3.0]


def test_artifact_shorthand_calls_shape() -> None:
    art = {"calls": [{"name": "f", "arguments": {"expression": "x^2"}}]}
    out = normalize_artifact(art)
    assert out["calls"][0]["arguments"]["expression"] == "x**2"


def test_artifact_does_not_mutate_original() -> None:
    art = {"toolCalls": [{"tool": "f", "args": {"function": "x^2"}}]}
    _ = normalize_artifact(art)
    assert art["toolCalls"][0]["args"]["function"] == "x^2"


def test_artifact_preserves_non_normalized_fields() -> None:
    art = {
        "toolCalls": [{"tool": "f", "args": {"function": "x^2"}}],
        "_meta": {"model": "test", "cost_usd": 0.01},
    }
    out = normalize_artifact(art)
    assert out["_meta"]["model"] == "test"
    assert out["_meta"]["cost_usd"] == 0.01


def test_artifact_empty_toolcalls_handled() -> None:
    art = {"toolCalls": []}
    out = normalize_artifact(art)
    assert out["toolCalls"] == []


def test_artifact_no_toolcalls_key_handled() -> None:
    art = {"_meta": {}}
    out = normalize_artifact(art)
    assert out == {"_meta": {}}
