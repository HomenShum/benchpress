# Architect Classifier Prompt

Versioned extraction of the system prompt used by the Architect page's
Gemini Flash Lite classifier. Source lives in
`convex/domains/daas/architectClassifier.ts` (`SYSTEM_PROMPT`); this doc
is the human-readable reference, not the source of truth.

## Why this doc exists

- The classifier's output shape (`runtime_lane`, `world_model_lane`,
  `intent_lane`, `checklist`, `rationale`, `missing_inputs`, `eval_plan`)
  is what every downstream surface consumes. Changing the prompt shape
  silently breaks Builder tabs, Radar priors, Fidelity trials.
- Calibration regresses silently otherwise. Every prompt revision must
  re-run `daas/classifier_eval/runner.py` against the 30-prompt gold
  set (`daas/classifier_eval/gold.jsonl`) and beat the last recorded
  baseline.

## Current baseline (v1, Cycle 18 re-verified)

Measured against n=30 gold prompts on `joyous-walrus-428`:

| Axis | Accuracy | Notes |
|---|---|---|
| intent | 93.3% (28/30) | strongest axis |
| world_model | 80.0% (24/30) | |
| runtime | 60.0% (18/30) | systematic under-scaffolding |
| all three match | 50.0% (15/30) | exact-triad baseline |

Known failure mode: classifier tends to pick `tool_first_chain` when
`orchestrator_worker` is gold (4/30) and `simple_chain` when
`tool_first_chain` is gold (3/30). Future prompt revisions should aim
to fix this without regressing the 93% intent accuracy.

## Attempted v2 (Cycle 18) — ROLLED BACK

Cycle 18 attempted to lift runtime accuracy by adding explicit
TRIGGERS blocks for each runtime lane (≥ 3 workers → orchestrator,
etc). Measured result:

| Axis | v2 result | vs v1 baseline | Verdict |
|---|---|---|---|
| intent | ~70% | -23pp | REGRESSION |
| runtime | 56.7% | -3.3pp | REGRESSION |
| all three | 43.3% | -6.7pp | REGRESSION |

The verbose discriminators confused Flash Lite — it over-picked
`keep_big_model` (runtime) and `unknown` (intent) under uncertainty.
Rolled back to v1 per the discipline rule:

> Any regression on INTENT > 2pp or RUNTIME > 3pp is a rollback.

Reversion verified: v1 baseline restored to the same ±2pp of the
original measurement.

## Rate-limit interaction gotcha (Cycle 18 fix)

While re-running eval, discovered that the rate-limit bucket key
`architect:<first-6-chars-of-slug>` caused 20/30 eval runs to be
rate-limited because eval slugs shared the `eval_1` prefix. Changed
bucket key to use the full slug — each session gets its own bucket.
This is actually a correctness improvement (per-session isolation)
not just a testing fix.

## Prompt structure (v1 — current)

```
You are attrition.sh's architecture triage classifier.

Given a user's problem description, classify it onto three bounded axes:

RUNTIME_LANE — pick exactly one:
  simple_chain        - bounded, deterministic, tool-routing or formatting
  tool_first_chain    - chain with structured tool calls + strict response schema
  orchestrator_worker - fan-out workers + handoffs + compaction required
  keep_big_model      - task depends on tacit judgment that cannot cleanly be externalized

WORLD_MODEL_LANE — pick exactly one:
  lite  - entities + schema only, no live state / policy / outcome tracking
  full  - needs entities + state + events + policies + actions + outcomes + evidence graph

INTENT_LANE — pick exactly one:
  compile_down - user has an expensive frontier agent and wants a cheaper production path
  compile_up   - user has a legacy chain / prompt stack and wants a richer scaffold
  translate    - user wants to port a working workflow across frameworks / SDKs
  greenfield   - no prior solution exists; user is starting fresh
  unknown      - insufficient context to confidently pick any of the above

Return STRICT JSON with EXACTLY these keys (no extra commentary, no markdown):
{
  "runtime_lane": "...",
  "world_model_lane": "...",
  "intent_lane": "...",
  "checklist": [...10 items...],
  "rationale": "2-4 sentence explanation",
  "missing_inputs": ["..."],
  "eval_plan": "one sentence"
}

Be strict. If the user's prompt is too vague to confidently pick a lane, set
intent_lane to "unknown" and mark the classifier's confidence in the rationale.
Never claim to have detected something you didn't.
```

Prefixed at call time by the `RECENT ECOSYSTEM CHANGES` block (Cycle 16)
with the last 10 Tier-1 Radar items whose `updatesPrior` is runtime or
eval.

## Server-side hardening

Even though the prompt asks for strict JSON, the Convex classifier **also**:

1. Strips any markdown code fences from the response before parsing.
2. Falls back to `keep_big_model` / `lite` / `unknown` on parse failure
   (never picks a confident lane when the output is unparseable).
3. Defensively normalizes enum values (any unknown value coerces to the
   safe fallback).
4. Truncates `rationale` to 3800 chars before committing.
5. Records a `harness_error` style fallback checklist when the model
   call itself errors (timeout, HTTP, rate limit, cost cap).
6. Checks per-session cost cap BEFORE the Gemini call (Cycle 13).
7. Checks rate-limit bucket BEFORE the Gemini call (Cycle 10 + Cycle 18
   bucket-key fix).
8. Accumulates cost AFTER successful Gemini call (Cycle 13).

These are the same HONEST_STATUS invariants the product enforces
everywhere else.

## How to iterate safely

```bash
# 1. Change the prompt in convex/domains/daas/architectClassifier.ts
# 2. Deploy:
npx convex deploy -y

# 3. Re-run eval against the gold set:
python -m daas.classifier_eval.runner --convex https://joyous-walrus-428.convex.cloud

# 4. Compare the per-axis accuracy + confusion matrix to the baseline
#    table above. Any regression on INTENT > 2pp or RUNTIME > 3pp is a
#    rollback. Document the shift here before landing the change.
```

Gold prompts span:
- 6 compile_down / 5 compile_up / 3 translate / 14 greenfield / 1 unknown intents
- 4 simple_chain / 9 tool_first_chain / 15 orchestrator_worker / 2 keep_big_model
- 18 lite / 12 full world models

When the prompt's failure mode shifts (e.g. new systematic bias), add a
gold prompt that isolates it. The gold set grows monotonically.

## Related

- `daas/classifier_eval/` — harness + gold prompts + per-run results
- `convex/domains/daas/architectClassifier.ts` — source
- `convex/domains/daas/architectRate.ts` — bucket limiting (20 / 5min per full sessionSlug)
- `convex/domains/daas/costCap.ts` — per-session $0.50 cost cap
- `convex/domains/daas/radar.ts::getClassifierPriors` — Tier-1 priors fed into prompt
