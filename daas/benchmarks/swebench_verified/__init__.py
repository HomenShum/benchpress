"""SWE-bench Verified — human-validated 500-instance coding benchmark.

Source: https://www.swebench.com/verified.html
Dataset: princeton-nlp/SWE-bench_Verified on HuggingFace

Each instance: a real GitHub issue + the repo at a specific commit +
gold patch + FAIL_TO_PASS / PASS_TO_PASS unit tests. Scoring runs the
agent's proposed patch in a Docker sandbox and checks unit-test outcomes
— deterministic, no LLM judge.

## Integration path

SWE-bench requires Docker. Install:

    pip install swebench-eval
    # also requires docker daemon running

Then set SWEBENCH_WORKDIR to a cache dir with ~100GB free (Docker
images for repo snapshots).

Without Docker + swebench-eval, run_task returns harness_error. The
loader works standalone via HF for shape inspection.
"""

from daas.benchmarks.swebench_verified.runner import (
    harness_available,
    load_tasks,
    run_task,
)

__all__ = ["harness_available", "load_tasks", "run_task"]
