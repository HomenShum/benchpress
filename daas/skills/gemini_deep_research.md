# gemini_deep_research — Gemini Deep Research Agent (Interactions API)

## When to pick this lane

- The user's workload needs **autonomous multi-step research**: plan →
  search → read → synthesize → cite — not a single-shot answer.
- Answers must be **grounded** in current web sources plus the user's
  own data (via File Search / MCP).
- Willing to pay for depth + wait minutes (Max tier) OR prefer speed
  on interactive surfaces (base tier).

## Two tiers

| Tier | Model alias | Backing | Latency | Best for |
|---|---|---|---|---|
| Deep Research | `deep_research` | Gemini 3.1 Pro | seconds | chat-surface research cards |
| Deep Research Max | `deep_research_max` | Gemini 3.1 Pro + extended tooling | minutes; BACKGROUND only | long-horizon diligence, CRM research |

## References

- API: [Gemini Deep Research Agent](https://ai.google.dev/gemini-api/docs/deep-research)
- Endpoint: `models/<model>:interactions` (Interactions API, preview)
- Companion docs: [Interactions API](https://ai.google.dev/gemini-api/docs/interactions), [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
- Announcement: [Deep Research Max: a step change for autonomous research agents](https://blog.google/innovation-and-ai/models-and-research/gemini-models/next-generation-gemini-deep-research/)
- Python SDK: `google-genai` (`from google import genai`)

## Files the agent should write

```
main.py             async entry: client.aio.models.interactions.create(...)
                    background=true -> poll until done
                    render cited report + surface researchSteps
research.py         small wrapper with a run(query, background, file_search)
                    interface + timeout guard
citations.py        parse + render citation list from response
tools.py            optional user-defined functionDeclarations combined
                    with Google Search / URL Context / Code Execution /
                    File Search presets
requirements.txt    google-genai ; anyio
README.md           GEMINI_API_KEY setup + background vs interactive modes
run.sh / .env.example / workflow_spec.json
eval/               scenarios.py (grounded-research cases) + rubric.py
```

## main.py spine (interactive / sync)

```python
from __future__ import annotations
import asyncio, os
from google import genai

async def research(question: str, *, max_results: int = 10) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    resp = await client.aio.models.interactions.create(
        model="gemini-3.1-pro",
        contents=[{"role": "user", "parts": [{"text": question}]}],
        config={
            "systemInstruction": {"parts": [{"text":
                "You are a diligent researcher. Cite every substantive claim."}]},
            "tools": [
                {"googleSearch": {}},
                {"urlContext": {}},
                {"codeExecution": {}},
            ],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 8192},
        },
        background=False,
    )
    return resp.to_dict()
```

## main.py spine (Max / background)

```python
from google import genai
import asyncio, os, time

async def research_max(question: str) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    op = await client.aio.models.interactions.create(
        model="gemini-3.1-pro",
        contents=[{"role": "user", "parts": [{"text": question}]}],
        config={
            "tools": [
                {"googleSearch": {}},
                {"urlContext": {}},
                {"fileSearch": {}},   # attach user's Vector Store
                {"codeExecution": {}},
            ],
        },
        background=True,   # REQUIRED for Max
    )
    deadline = time.time() + 600   # 10 min
    while time.time() < deadline:
        await asyncio.sleep(5)
        state = await client.aio.operations.get(op.name)
        if state.done:
            return state.response.to_dict()
    raise TimeoutError("deep_research_max exceeded 10 min")
```

## Key invariants

- ALWAYS use `background=True` for Max; the operation may outlive an
  HTTP connection.
- Poll interval: start at 5 s; back off exponentially after 60 s.
- Surface `researchSteps` (the plan) + `citations` (sources per claim)
  in the final report. Without citations the research is not grounded.
- Combine research tools freely: `googleSearch` + `urlContext` +
  `codeExecution` + `fileSearch` are composable in the same call.
- Turn off web entirely by passing only `fileSearch` — this gives
  closed-world research over the user's own corpus.

## Known failure modes

- Forgetting `background=True` on Max → HTTP timeout before synthesis
  completes. Fix: check the tier constant, auto-enable background.
- Polling without a deadline → unbounded wait. Fix: 10 min ceiling.
- Not surfacing citations → the report looks hallucinated even when
  it isn't. Fix: always render the citations section.

## Eval criteria

- Smoke: question "What is the latest Gemini model?" returns a
  report that names Gemini 3 Pro / Flash Lite with at least one
  citation URL matching ai.google.dev.
- Scenario: a closed-world question against a File Search store
  should NOT cite external URLs when web tools are disabled.
- Max-tier scenario: a compound diligence question ("give me a
  10-section diligence memo on Company X with CRM-ready citations")
  returns in < 10 min with citations for every claim.
