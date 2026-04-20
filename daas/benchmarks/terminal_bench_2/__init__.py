"""Terminal-Bench 2.0 — long-horizon terminal agent benchmark.

Source: https://github.com/terminal-bench/terminal-bench
89 high-quality tasks across software engineering, ML, security,
data science, etc. Each task requires the agent to achieve a concrete
terminal goal inside a sandboxed container.

## Integration path

Terminal-Bench runs inside Docker sandboxes. Install the upstream
harness and Docker, then run:

    pip install terminal-bench
    terminal-bench eval <agent> <task_id>

Without Docker + harness, run_task returns harness_error. The loader
works standalone to let you inspect task shapes and plan agent
prompts.
"""

from daas.benchmarks.terminal_bench_2.runner import (
    harness_available,
    load_tasks,
    run_task,
)

__all__ = ["harness_available", "load_tasks", "run_task"]
