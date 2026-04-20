"""IF-RewardBench — instruction-following meta-evaluation benchmark.

Source: allenai/IF-RewardBench on HuggingFace
License: ODC-By (dataset), Apache 2.0 (code)

842 instructions spanning single-turn, multi-turn, and system-prompt
steerability. Includes explicit per-check rubrics (checklists) and
preference graphs — maps directly onto attrition's named-boolean
checks architecture.

This is the strongest fit for attrition's rubric judge shape because
every instance ships with its own checklist, so we can validate
whether a rubric check is actually discriminative rather than just
plausible-sounding.
"""

from daas.benchmarks.if_rewardbench.runner import (
    extract_pick,
    live_replay,
    load_tasks,
    run_task,
)

__all__ = ["extract_pick", "live_replay", "load_tasks", "run_task"]
