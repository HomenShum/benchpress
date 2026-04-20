"""Arena-Hard-Auto — hard real-world prompt preference calibration.

Source: https://github.com/lmarena/arena-hard-auto
Builds on LMArena conversations; aims to correlate with arena rankings.

Preference-oriented, not truth-oriented — use as secondary judge
calibration, never as a primary Loop A benchmark. JudgeBench remains
the primary.
"""

from daas.benchmarks.arena_hard_auto.runner import (
    extract_pick,
    live_replay,
    load_tasks,
    run_task,
)

__all__ = ["extract_pick", "live_replay", "load_tasks", "run_task"]
