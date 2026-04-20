"""MCP-Atlas — multi-tool orchestration benchmark (real MCP servers).

Source: https://github.com/mcp-atlas/mcp-atlas
License: Apache 2.0

500-task public subset where each task requires 3-6 tool calls against
real MCP servers with diagnostics on:
  - tool discovery
  - parameterization
  - syntax
  - error recovery
  - efficiency

## Integration path

MCP-Atlas requires a live MCP server cluster to score against. The
scoring layer is a Python package that expects MCP endpoints to be
reachable. Install the upstream harness:

    pip install mcp-atlas           # when published to PyPI; today:
    pip install -e git+https://github.com/mcp-atlas/mcp-atlas

Then set ``MCP_ATLAS_SERVER_CONFIG`` to a YAML file describing the
servers to score against.

Without the harness present, ``run_task`` returns harness_error —
never a fake verdict.

## Attrition-side rollup

Use MCP-Atlas when a user's architect intake includes MCP servers in
the tool surface. Pair with BFCL v4 for AST-level parity (deterministic)
and MCP-Atlas for end-to-end workflow scoring (partially LLM-judged per
upstream design).
"""

from daas.benchmarks.mcp_atlas.runner import (
    harness_available,
    load_tasks,
    run_task,
)

__all__ = ["harness_available", "load_tasks", "run_task"]
