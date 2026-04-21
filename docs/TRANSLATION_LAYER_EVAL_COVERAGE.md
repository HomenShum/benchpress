# Translation + post-scaffold evaluation coverage

## The gap the BFCL-only test missed

The current `scaffold_runtime_fidelity.py` evaluates scaffolds against
BFCL-simple — single-call math / utility functions. Real agent work
uses a wider tool surface:

| Category | Tools | % of real Claude Code sessions |
|---|---|---|
| file | Read, Write, Edit, Glob, Grep | ~60% of steps |
| shell | Bash, exec, run | ~20% |
| agent | Task / subagent spawn | ~5% |
| search | WebSearch, WebFetch | ~5% |
| codegen | Write (new file), emit component | ~10% |
| think | Plan, scratchpad | interleaved |

BFCL-simple ≈ a narrow slice of "file" + pure math. The 0/20 regression
we measured is real, but it's on the easiest possible target. The
scaffold must ALSO preserve fidelity on the harder tool surfaces.

## What broadened coverage requires

1. **Scenarios** — new file: `daas/benchmarks/broadened_eval_scenarios.py`
   ships 8 category-tagged scenarios covering file (read/edit/glob),
   shell, subagent, web search + fetch, and codegen.

2. **Realistic per-category mock responses** — the emitter's current
   universal `{"status": "mock", "_result": "fixture-placeholder"}` is
   content-free. The bounded loop's compact step has nothing to
   synthesize from. Each scenario now declares a `mock_response` that
   the emitter can use to return plausible domain-shaped data
   (file contents, subagent result text, web-search snippets).

3. **Category-aware judge checks** — the 6-boolean rubric in
   `eval/rubric.py` scores fidelity vs an original answer. Broadened
   coverage adds a 7th boolean per category, asking: did the scaffold
   emit the RIGHT KIND of tool for this task? (e.g. `file` task →
   `read_file` / `edit_file` call, not bash or prose.)

4. **Reporter** — `scaffold_runtime_fidelity.py` groups results by
   category so we can see where the scaffold preserves baseline
   vs where it regresses. "0/20 on BFCL-simple" collapses to one
   number; per-category breakdown reveals whether the scaffold
   handles file tools but chokes on subagent spawning.

## Next cycle

- Wire `broadened_eval_scenarios.SCENARIOS` into
  `scaffold_runtime_fidelity.py` as a third task source.
- Extend the emitter's `_stub_<name>` handlers to consult a
  per-tool mock-response map instead of the universal placeholder.
- Add the category check to `eval/rubric.py` so the judge
  emits one extra boolean per category seen in the run.
- Re-run with the prompt + toolConfig.mode=ANY fixes already in
  `tool_first_chain.py`; report pass rates per category.

## The product invariant the gate preserves

`EVAL_VERDICT.status = "transfers"` requires **every category** the
user's spec exercises to preserve baseline parity. A scaffold that
passes BFCL but fails file-tool scenarios still locks downloads.
The gate composes.
