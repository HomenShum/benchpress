"""Offline tests for Cycle 4 benchmark adapters + PoLL."""

from __future__ import annotations

import pytest

from daas.benchmarks import BenchmarkResult


# ---------------------------------------------------------------------------
# IF-RewardBench
# ---------------------------------------------------------------------------


def test_if_rewardbench_run_task_chosen_is_A() -> None:
    from daas.benchmarks.if_rewardbench.runner import run_task

    task = {
        "task_id": "t1",
        "prompt": "Write a haiku.",
        "response_chosen": "A correct haiku",
        "response_rejected": "A wrong thing",
    }
    # Judge correctly picked A (chosen) -> pass
    r = run_task(task, {"pick": "A", "_meta": {}})
    assert r.benchmark_id == "if_rewardbench"
    assert r.passed is True
    # Judge picked B (rejected) -> fail
    r = run_task(task, {"pick": "B", "_meta": {}})
    assert r.passed is False


def test_if_rewardbench_missing_chosen_is_harness_error() -> None:
    from daas.benchmarks.if_rewardbench.runner import run_task

    r = run_task({"task_id": "t", "prompt": "x"}, {"pick": "A", "_meta": {}})
    assert r.harness_error == "missing_response_chosen"


# ---------------------------------------------------------------------------
# BFCL v4
# ---------------------------------------------------------------------------


def test_bfcl_v4_rebrands_benchmark_id() -> None:
    from daas.benchmarks.bfcl_v4 import run_task

    task = {
        "id": "smoke",
        "ground_truth": [{"name": "add", "arguments": {"a": 1, "b": 2}}],
    }
    artifact = {"toolCalls": [{"tool": "add", "args": {"a": 1, "b": 2}}]}
    r = run_task(task, artifact)
    assert r.benchmark_id == "bfcl_v4"
    assert r.passed is True


# ---------------------------------------------------------------------------
# MCP-Atlas
# ---------------------------------------------------------------------------


def test_mcp_atlas_harness_missing_is_honest() -> None:
    from daas.benchmarks.mcp_atlas import run_task, harness_available

    if harness_available():
        pytest.skip("mcp_atlas harness installed; cannot test missing case")
    r = run_task({"task_id": "t"}, {"_meta": {}})
    assert r.passed is False
    assert r.harness_error is not None
    assert "mcp_atlas_harness_missing" in r.harness_error


# ---------------------------------------------------------------------------
# Terminal-Bench 2
# ---------------------------------------------------------------------------


def test_terminal_bench_harness_missing_is_honest() -> None:
    from daas.benchmarks.terminal_bench_2 import harness_available, run_task

    if harness_available():
        pytest.skip("terminal_bench installed and docker reachable")
    r = run_task({"task_id": "t"}, {"_meta": {}})
    assert r.passed is False
    assert r.harness_error is not None
    assert "terminal_bench_missing_or_no_docker" in r.harness_error


# ---------------------------------------------------------------------------
# BrowseComp
# ---------------------------------------------------------------------------


def test_browsecomp_extract_answer_patterns() -> None:
    from daas.benchmarks.browsecomp.runner import extract_answer

    assert extract_answer("... Final answer: 42\n") == "42"
    assert extract_answer("blah. answer: Paris.") == "Paris"
    assert extract_answer("Therefore \\boxed{1789}") == "1789"
    # Fallback to last line
    assert extract_answer("Reasoning...\n\n1492") == "1492"


def test_browsecomp_exact_match_scoring() -> None:
    from daas.benchmarks.browsecomp.runner import run_task

    task = {"task_id": "t", "answer": "Paris"}
    r = run_task(task, {"answer": "paris.", "_meta": {}})
    assert r.passed is True
    r = run_task(task, {"answer": "London", "_meta": {}})
    assert r.passed is False


def test_browsecomp_missing_gold_is_harness_error() -> None:
    from daas.benchmarks.browsecomp.runner import run_task

    r = run_task({"task_id": "t"}, {"answer": "x", "_meta": {}})
    assert r.harness_error == "missing_gold_answer"


# ---------------------------------------------------------------------------
# SWE-bench Verified
# ---------------------------------------------------------------------------


def test_swebench_harness_missing_is_honest() -> None:
    from daas.benchmarks.swebench_verified import harness_available, run_task

    if harness_available():
        pytest.skip("swebench harness installed and docker reachable")
    r = run_task({"instance_id": "i1"}, {"patch": "diff --git a/x b/x", "_meta": {}})
    assert r.passed is False
    assert r.harness_error is not None
    assert "swebench_harness_missing_or_no_docker" in r.harness_error


def test_swebench_no_patch_is_harness_error_even_with_harness() -> None:
    from daas.benchmarks.swebench_verified import run_task

    # Whether or not harness is installed, a missing patch must be honest
    r = run_task({"instance_id": "i1"}, {"_meta": {}})
    assert r.passed is False
    assert r.harness_error is not None
    # Either harness_missing or no_patch — both are honest
    assert (
        "no_patch_in_artifact" in (r.harness_error or "")
        or "swebench_harness_missing" in (r.harness_error or "")
    )


# ---------------------------------------------------------------------------
# Arena-Hard-Auto
# ---------------------------------------------------------------------------


def test_arena_hard_missing_gold_is_harness_error() -> None:
    from daas.benchmarks.arena_hard_auto import run_task

    r = run_task({"question_id": "q1"}, {"pick": "A", "_meta": {}})
    assert r.harness_error == "missing_gold"


def test_arena_hard_normalizes_label() -> None:
    from daas.benchmarks.arena_hard_auto import run_task

    task = {"question_id": "q1", "gold": "A>B"}  # comparator form
    r = run_task(task, {"pick": "A", "_meta": {}})
    assert r.passed is True


# ---------------------------------------------------------------------------
# RewardBench 2
# ---------------------------------------------------------------------------


def test_rewardbench_chosen_is_A() -> None:
    from daas.benchmarks.rewardbench_2 import run_task

    task = {"id": "r1", "prompt": "x", "chosen": "good", "rejected": "bad"}
    r = run_task(task, {"pick": "A", "_meta": {}})
    assert r.passed is True
    r = run_task(task, {"pick": "B", "_meta": {}})
    assert r.passed is False


def test_rewardbench_missing_chosen_is_harness_error() -> None:
    from daas.benchmarks.rewardbench_2 import run_task

    r = run_task({"id": "r1", "prompt": "x"}, {"pick": "A", "_meta": {}})
    assert r.harness_error == "missing_chosen"


# ---------------------------------------------------------------------------
# PoLL
# ---------------------------------------------------------------------------


def test_poll_unanimous_panel() -> None:
    from daas.benchmarks.poll import run_panel

    judges = {
        f"judge_{i}": lambda t, i=i: {"pick": "A", "confidence": 0.9, "error": None}
        for i in range(3)
    }
    v = run_panel({"q": "x"}, judges)
    assert v.pick == "A"
    assert v.confidence == 1.0
    assert v.low_confidence is False
    assert v.errors == 0


def test_poll_majority_wins() -> None:
    # 2/3 majority — considered acceptable confidence (above 66% threshold)
    from daas.benchmarks.poll import run_panel

    judges = {
        "j1": lambda t: {"pick": "A", "confidence": 1.0, "error": None},
        "j2": lambda t: {"pick": "A", "confidence": 1.0, "error": None},
        "j3": lambda t: {"pick": "B", "confidence": 1.0, "error": None},
    }
    v = run_panel({"q": "x"}, judges)
    assert v.pick == "A"
    assert v.confidence == pytest.approx(2 / 3)
    # 66.7% > 66% threshold -> NOT low confidence
    assert v.low_confidence is False


def test_poll_bare_plurality_is_low_confidence() -> None:
    # 2/5 plurality (40%) — below threshold, flag as low confidence
    from daas.benchmarks.poll import run_panel

    judges = {
        "j1": lambda t: {"pick": "A", "confidence": 1.0, "error": None},
        "j2": lambda t: {"pick": "A", "confidence": 1.0, "error": None},
        "j3": lambda t: {"pick": "B", "confidence": 1.0, "error": None},
        "j4": lambda t: {"pick": "B", "confidence": 1.0, "error": None},
        "j5": lambda t: {"pick": None, "confidence": 0.0, "error": None},
    }
    v = run_panel({"q": "x"}, judges)
    # 2 vs 2 for A vs B, both equal -> tie -> refuse pick
    assert v.pick is None
    assert v.low_confidence is True


def test_poll_tie_refuses_pick() -> None:
    from daas.benchmarks.poll import run_panel

    judges = {
        "j1": lambda t: {"pick": "A", "confidence": 1.0, "error": None},
        "j2": lambda t: {"pick": "B", "confidence": 1.0, "error": None},
    }
    v = run_panel({"q": "x"}, judges)
    assert v.pick is None  # refuse tie
    assert v.low_confidence is True


def test_poll_judge_error_counted_not_hidden() -> None:
    from daas.benchmarks.poll import run_panel

    judges = {
        "bad": lambda t: (_ for _ in ()).throw(RuntimeError("oops")),
        "good1": lambda t: {"pick": "A", "confidence": 1.0, "error": None},
        "good2": lambda t: {"pick": "A", "confidence": 1.0, "error": None},
    }
    v = run_panel({"q": "x"}, judges)
    assert v.errors == 1
    assert v.pick == "A"  # majority still holds
    # The errored judge must appear in per_judge
    err_entries = [r for r in v.per_judge if r.error]
    assert len(err_entries) == 1
