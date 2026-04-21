"""Broadened runtime-fidelity scenarios — catering to the tool surfaces
real agents actually use (file, subagent, web search, codegen), not
just BFCL-simple single-call math.

Lesson from Mario Zechner's "Building pi in a World of Slop" talk
(AI Engineer Europe 2026): Terminus-class MINIMAL harnesses top
Terminal-Bench 2.0. Our scaffold regressed on BFCL for the opposite
reason — it over-wraps. The fix is a two-part alignment:

    1. Evaluate against the tool CATEGORIES real agents exercise:
         file    — Read / Write / Edit / Glob / Grep
         shell   — Bash / run / exec
         agent   — Task / subagent spawn / delegate
         search  — WebSearch / WebFetch
         codegen — Write new Python / TS / component
         think   — Plan / scratchpad / reason

    2. Make the emitter's MOCK responses realistic per-category so
       the scaffold's bounded loop has something semantically
       useful to compact from — not a universal
       ``{"status": "mock", "_result": "fixture-placeholder"}``.

This file defines the scenario set + per-category scoring rules.
The actual live runner is scaffold_runtime_fidelity.py; this module
feeds it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


# --- category taxonomy ---------------------------------------------------
# Maps tool-name substrings to a coarse category. Matches the classifier
# used in daas/compile_down/meta_workflow.py so scenarios align with
# phases distilled from real Claude Code traces.
TOOL_CATEGORIES: dict[str, tuple[str, ...]] = {
    "file": (
        "read_file", "write_file", "edit_file", "glob", "grep",
        "list_files", "search_files", "view", "create_file", "patch",
    ),
    "shell": ("bash", "shell", "exec", "run_command", "compile", "test"),
    "agent": (
        "task", "agent", "delegate", "spawn", "teammate", "subagent",
    ),
    "search": (
        "web_search", "websearch", "web_fetch", "webfetch",
        "fetch_url", "search_web",
    ),
    "codegen": (
        "write_code", "generate_code", "emit_component", "scaffold",
        "codegen",
    ),
    "think": ("plan", "scratchpad", "note", "reflect"),
}


# --- scenarios -----------------------------------------------------------
@dataclass
class Scenario:
    id: str
    category: str  # one of the keys in TOOL_CATEGORIES
    prompt: str
    tool_spec: dict[str, Any]
    # Expected tool-call shape the scaffold must produce. Use ANY
    # string as a wildcard for arg values where exact match doesn't
    # matter (e.g. file paths that the model picks).
    expected_name: str
    expected_arg_keys: list[str] = field(default_factory=list)
    # Optional per-scenario mock response the emitter should return
    # when this tool is invoked in mock mode. Realistic responses
    # give the scaffold's compact step something to work with.
    mock_response: dict[str, Any] = field(default_factory=dict)


SCENARIOS: list[Scenario] = [
    # --- file tools --------------------------------------------------
    Scenario(
        id="file_read_01",
        category="file",
        prompt="Read the contents of src/config.py so I can see what's defined.",
        tool_spec={
            "name": "read_file",
            "description": "Read a file from the working tree and return its contents.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "path": {"type": "STRING", "description": "Relative path"},
                },
                "required": ["path"],
            },
        },
        expected_name="read_file",
        expected_arg_keys=["path"],
        mock_response={
            "status": "mock",
            "tool": "read_file",
            "content": "# src/config.py\nDEBUG = True\nVERSION = '1.0.0'\n",
            "lines": 3,
        },
    ),
    Scenario(
        id="file_edit_01",
        category="file",
        prompt="Change the VERSION in src/config.py to '1.1.0'.",
        tool_spec={
            "name": "edit_file",
            "description": "Replace a substring in a file.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "path": {"type": "STRING"},
                    "old_string": {"type": "STRING"},
                    "new_string": {"type": "STRING"},
                },
                "required": ["path", "old_string", "new_string"],
            },
        },
        expected_name="edit_file",
        expected_arg_keys=["path", "old_string", "new_string"],
        mock_response={
            "status": "mock",
            "tool": "edit_file",
            "bytes_changed": 5,
            "match_count": 1,
        },
    ),
    Scenario(
        id="file_glob_01",
        category="file",
        prompt="Find all TypeScript files under src/components/.",
        tool_spec={
            "name": "glob",
            "description": "List files matching a glob pattern.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "pattern": {"type": "STRING"},
                },
                "required": ["pattern"],
            },
        },
        expected_name="glob",
        expected_arg_keys=["pattern"],
        mock_response={
            "status": "mock",
            "tool": "glob",
            "files": [
                "src/components/Header.tsx",
                "src/components/Button.tsx",
                "src/components/ProofSection.tsx",
            ],
            "count": 3,
        },
    ),
    # --- subagent ---------------------------------------------------
    Scenario(
        id="agent_task_01",
        category="agent",
        prompt="Delegate a research task: find out when Next.js 16 was released.",
        tool_spec={
            "name": "task",
            "description": "Spawn a sub-agent to handle a scoped task.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "subagent_type": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "prompt": {"type": "STRING"},
                },
                "required": ["subagent_type", "prompt"],
            },
        },
        expected_name="task",
        expected_arg_keys=["subagent_type", "prompt"],
        mock_response={
            "status": "mock",
            "tool": "task",
            "subagent_result": (
                "Next.js 16 was released in early 2026 with the stable App "
                "Router, React 19 support, and Turbopack by default."
            ),
            "sub_tokens_used": 420,
        },
    ),
    # --- web search -------------------------------------------------
    Scenario(
        id="search_web_01",
        category="search",
        prompt=(
            "Search the web for the latest benchmark scores of Claude Opus "
            "4.7 on SWE-bench Verified."
        ),
        tool_spec={
            "name": "web_search",
            "description": "Search the web and return ranked snippets.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "query": {"type": "STRING"},
                    "top_k": {"type": "INTEGER"},
                },
                "required": ["query"],
            },
        },
        expected_name="web_search",
        expected_arg_keys=["query"],
        mock_response={
            "status": "mock",
            "tool": "web_search",
            "results": [
                {
                    "title": "Claude Opus 4.7 benchmarks",
                    "url": "https://vellum.ai/blog/claude-opus-4-7",
                    "snippet": "Claude Opus 4.7 scores 62.3% on SWE-bench Verified.",
                },
            ],
            "count": 1,
        },
    ),
    Scenario(
        id="search_fetch_01",
        category="search",
        prompt="Fetch the README of github.com/anthropics/claude-code.",
        tool_spec={
            "name": "web_fetch",
            "description": "Fetch a URL and return its text content.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "url": {"type": "STRING"},
                },
                "required": ["url"],
            },
        },
        expected_name="web_fetch",
        expected_arg_keys=["url"],
        mock_response={
            "status": "mock",
            "tool": "web_fetch",
            "text": "# claude-code\n\nAnthropic's official CLI for Claude...",
            "status_code": 200,
        },
    ),
    # --- shell ------------------------------------------------------
    Scenario(
        id="shell_run_01",
        category="shell",
        prompt="Run the test suite with pytest.",
        tool_spec={
            "name": "bash",
            "description": "Run a shell command.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "command": {"type": "STRING"},
                },
                "required": ["command"],
            },
        },
        expected_name="bash",
        expected_arg_keys=["command"],
        mock_response={
            "status": "mock",
            "tool": "bash",
            "stdout": "====== 42 passed in 3.1s ======",
            "exit_code": 0,
        },
    ),
    # --- codegen ----------------------------------------------------
    Scenario(
        id="codegen_write_01",
        category="codegen",
        prompt=(
            "Create a new file src/lib/formatDate.ts exporting a formatDate "
            "function that returns ISO dates."
        ),
        tool_spec={
            "name": "write_file",
            "description": "Write a new file with the given contents.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "path": {"type": "STRING"},
                    "contents": {"type": "STRING"},
                },
                "required": ["path", "contents"],
            },
        },
        expected_name="write_file",
        expected_arg_keys=["path", "contents"],
        mock_response={
            "status": "mock",
            "tool": "write_file",
            "bytes_written": 180,
            "created": True,
        },
    ),
]


# --- scoring -------------------------------------------------------------
def score_scenario(scenario: Scenario, actual_calls: list[dict[str, Any]]) -> tuple[bool, str]:
    """Category-aware scoring.

    Pass iff the scaffold emitted at least one call that:
      - has the expected tool name, AND
      - provides every expected arg key with a non-empty value.

    Returns (passed, reason).
    """
    if not actual_calls:
        return False, "no tool calls emitted — scaffold returned prose"
    for call in actual_calls:
        name = str(call.get("name") or call.get("tool") or "")
        args = call.get("arguments") or call.get("args") or {}
        if not isinstance(args, dict):
            continue
        if name != scenario.expected_name:
            continue
        missing = [k for k in scenario.expected_arg_keys if not args.get(k)]
        if missing:
            return False, f"correct tool but missing args: {missing}"
        return True, "pass"
    return (
        False,
        f"expected '{scenario.expected_name}' but got: "
        + ", ".join(
            sorted(
                {str(c.get("name") or c.get("tool") or "?") for c in actual_calls}
            )
        ),
    )


def scenarios_by_category() -> dict[str, list[Scenario]]:
    out: dict[str, list[Scenario]] = {}
    for s in SCENARIOS:
        out.setdefault(s.category, []).append(s)
    return out


# --- judge rubric extension ----------------------------------------------
# The boolean rubric in eval/rubric.py handles content fidelity. This
# rubric extension adds a CATEGORY-aware gate: did the scaffold make
# the RIGHT KIND of tool call for this kind of task?
CATEGORY_CHECKS: dict[str, str] = {
    "file": (
        "emitted_a_file_tool: did the scaffold emit a file-shaped "
        "tool call (read_file, edit_file, glob, grep, write_file) "
        "when the task asked to inspect or modify code?"
    ),
    "shell": (
        "emitted_a_shell_tool: did the scaffold emit bash/exec/run "
        "when the task asked to execute something?"
    ),
    "agent": (
        "emitted_a_subagent_spawn: did the scaffold emit a task / "
        "delegate / subagent call when the task asked to delegate?"
    ),
    "search": (
        "emitted_a_search_tool: did the scaffold emit web_search / "
        "web_fetch when the task asked for external information?"
    ),
    "codegen": (
        "emitted_a_codegen_tool: did the scaffold emit write_file / "
        "scaffold / generate_code when asked to create new code?"
    ),
    "think": (
        "emitted_a_planning_step: did the scaffold pause to plan "
        "when the task implied multi-step reasoning?"
    ),
}


__all__ = [
    "TOOL_CATEGORIES",
    "Scenario",
    "SCENARIOS",
    "CATEGORY_CHECKS",
    "scenarios_by_category",
    "score_scenario",
]
