"""BrowseComp — web research benchmark with hard-to-solve / easy-to-verify tasks.

Source: OpenAI BrowseComp (https://openai.com/index/browsecomp/)
Design: short correct answers, difficult browsing paths. The verification
asymmetry is what makes BrowseComp useful for judge cycles — gold
answers are short and exact-match-scoreable, even though getting to
them requires real web navigation.

## Scoring

BrowseComp ground truth is a short factual answer (a number, a name,
a date). We exact-match after normalization (lowercasing, whitespace
trim, optional numeric coercion). No LLM judge.

## Note

The browsing itself happens in the agent under test, not this adapter.
This adapter only:
  1. Loads tasks (question + gold answer)
  2. Extracts the final answer from the agent's response
  3. Exact-matches against gold
"""

from daas.benchmarks.browsecomp.runner import (
    extract_answer,
    live_replay,
    load_tasks,
    run_task,
)

__all__ = ["extract_answer", "live_replay", "load_tasks", "run_task"]
