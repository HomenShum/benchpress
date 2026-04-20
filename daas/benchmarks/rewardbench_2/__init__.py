"""RewardBench 2 — harder successor to RewardBench for reward-model / reranker judges.

Source: allenai/reward-bench on HuggingFace (v2 split)
Includes factuality + precise instruction-following.

Pairwise preference format like JudgeBench / IF-RewardBench. Adapter
delegates pairwise logic to the judgebench runner.
"""

from daas.benchmarks.rewardbench_2.runner import (
    live_replay,
    load_tasks,
    run_task,
)

__all__ = ["live_replay", "load_tasks", "run_task"]
