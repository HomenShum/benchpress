# Fidelity — Transfer Judgment From Runtime To Compile-Time

## The one problem this solves

**Transferring tacit judgment from model inference (runtime) into externalized
structure (compile-time) without losing fidelity — and knowing when you can't.**

Every form of distillation is the same move in different clothing:

| Form | What gets externalized | Where it lives |
|---|---|---|
| Prompt distillation (CoT, role framing) | Reasoning pattern | System prompt string |
| Tool / harness distillation | Tool choice + output shape discipline | Tool allowlist + response schema |
| Full scaffold (LangGraph / agent SDK) | Multi-step decomposition | Directed graph of workers + handoffs |

All three attempt the same thing: *move the big model's implicit decision-making
OUT of its weights and INTO an artifact a small model can execute, such that
the small model's output is indistinguishable from the big model's on the same
input.*

Fidelity measures, honestly, whether that move worked.

## The 3-measurement template (the only API)

```
baseline   = small_model.solo(task)                    # no scaffold
ceiling    = large_model.solo(task)                    # reference
distilled  = small_model(task, scaffold=artifact)      # the claim
```

From these three measurements:

```
gap        = ceiling.rate  - baseline.rate            # what's to transfer
transfer   = distilled.rate - baseline.rate            # what transferred
fidelity   = transfer / gap                            # fraction of gap closed
```

Every "distillation lift" claim the product ever makes must come from this
template. No free-form scores. No LLM judging an LLM. Only ground-truth pass/fail
from a deterministic benchmark (BFCL AST check, MMLU-Pro letter match, SWE-bench
unit tests, τ²-bench DB state).

## Bounded verdicts

The classifier returns exactly one of five values:

| Verdict | Condition | What to do |
|---|---|---|
| `transfers` | gap significant (Newcombe CI excludes 0), transfer significant, fidelity ≥ 80% | Ship the scaffold |
| `lossy` | gap and transfer both significant, fidelity < 80% | Redistill with richer traces, or route high-value tasks to big model |
| `no_gap` | gap NOT significant (CI spans 0) | Remove scaffold; route to small model solo |
| `regression` | baseline – distilled significant (scaffold hurts) | Remove scaffold immediately |
| `insufficient_data` | n < 60 (minimum for non-trivial Wilson halfwidth) | Run more trials |

Verdicts are computed with **Newcombe's method** for the CI of a proportion
difference (Newcombe 1998). We only call a difference significant when the
95% CI excludes zero. Point estimates alone never determine a verdict.

## Why these specific invariants

- **Minimum n = 60.** At n=60, Wilson halfwidth at p=0.5 is ≈13pp. Below that,
  claiming single-digit gaps is noise. At n=200 halfwidth drops to ~7pp, which
  is what SWE-bench and BFCL papers use.

- **Fidelity threshold = 80%.** Below this the distilled line is clearly
  partway between baseline and ceiling — useful information (scaffold helps)
  but not a shippable "transfer" claim. Calibrated against the falsification
  discipline documented in `BFCL_FALSIFICATION_FINDINGS.md`.

- **Harness errors excluded from rates.** A trial where ANY of the three
  measurements errored is dropped from the denominator. A timeout isn't a
  scaffold failure.

- **Artifact size ≤ 32KB.** The full externalization is loaded into the
  small model's context on every distilled call. Bigger artifact = more
  tokens = cost shifted back to runtime. Keep scaffolds compact.

## Architecture

```
                     ┌─────────────────────┐
                     │  daasExternalizations │
                     │  (compile-time blob)  │
                     └──────────┬───────────┘
                                │ applied via
                                │ apply_scaffold(task, ext)
                                ▼
                     ┌─────────────────────┐
                     │  Trial runner       │   runs 3x per task:
                     │  daas.fidelity.trial│     baseline, ceiling, distilled
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  daasFidelityTrials │   append-only per-task rows
                     └──────────┬───────────┘
                                │ aggregated via
                                │ classify(trials)
                                ▼
                     ┌─────────────────────┐
                     │  daasFidelityVerdicts│   bounded-enum verdict
                     └──────────┬───────────┘
                                │ surfaced at
                                ▼
                     ┌─────────────────────┐
                     │  attrition.sh/fidelity│   one dashboard row per
                     │  (public dashboard)  │   externalization × benchmark
                     └─────────────────────┘
```

## File inventory

### Python (the trial runner + adapters)
```
daas/fidelity/
  __init__.py      — public exports (Externalization, FidelityTrial, classify, …)
  types.py         — dataclasses; bounded enums mirrored to Convex schema
  verdict.py       — Wilson + Newcombe CIs, classify() decision tree
  trial.py         — run_trials() + adapter Protocol + scaffold helpers
  cli.py           — command-line entry point
  artifacts/
    mmlu_pro_cot_v1.json — first real distilled preamble (hand-authored
                            from Pro's observed CoT pattern)
```

### Convex
```
convex/domains/daas/
  schema.ts       — daasExternalizations, daasFidelityTrials, daasFidelityVerdicts
                    + DAAS_EXTERNALIZATION_FORMS, DAAS_TRANSFER_VERDICTS enums
  fidelity.ts     — registerExternalization, recordTrial, recordVerdict,
                    listExternalizations, listLatestVerdicts,
                    listVerdictHistory, listTrials
```

### Frontend
```
frontend/src/pages/Fidelity.tsx   — attrition.sh/fidelity public dashboard
frontend/src/main.tsx             — route added
```

### Tests
```
daas/tests/
  test_fidelity_verdict.py  — 17 scenario cases covering every verdict branch
                               + Wilson / Newcombe unit tests
                               + harness-error exclusion
                               + insufficient-data refusal
                               + fidelity math correctness
```

## Running a trial

```
python -m daas.fidelity.cli \
  --benchmark mmlu_pro \
  --externalization-id mmlu_pro_cot_v1 \
  --form prompt \
  --artifact daas/fidelity/artifacts/mmlu_pro_cot_v1.json \
  --source-model gemini-3.1-pro-preview \
  --small-model gemini-3.1-flash-lite-preview \
  --large-model gemini-3.1-pro-preview \
  --limit 60 --record
```

Cost: ~$0.10-0.20 for 60 MMLU-Pro tasks (60 × 3 models × ~$0.0005 avg).
Wall time: ~10 minutes sequential. All results persisted to
`joyous-walrus-428.convex.cloud` and visible at `https://attrition.sh/fidelity`.

## What this system refuses to do

- **Report a pass rate without a CI.** Every stored measurement has
  `ci_lo` and `ci_hi`.
- **Claim significance without Newcombe.** All three significance flags
  (`gap_significant`, `transfer_significant`, `regression_significant`) are
  computed from Newcombe CIs on proportion differences.
- **Say "transfers" on n<60.** Classifier emits `insufficient_data` with a
  narrative pointing at the sample requirement.
- **Count harness failures as scaffold failures.** Errored trials are split
  out to a separate `harness_errors` count and excluded from the rate
  denominator.
- **Accept free-form verdict strings.** Schema validator rejects anything
  not in `DAAS_TRANSFER_VERDICTS`.

## Related documents

- `docs/JUDGE_EVAL_BENCHMARKS.md` — the five public benchmarks chosen as
  ground-truth judges (BFCL, MMLU-Pro, τ²-bench, SWE-bench, ReportBench).
- `docs/BFCL_FALSIFICATION_FINDINGS.md` — the falsification that produced
  the "minimum n = 60" invariant and the "Newcombe CI, not point estimate"
  discipline.

## Prior art

- Newcombe, R.G. (1998). "Interval estimation for the difference between
  independent proportions." *Statistics in Medicine* 17, 873–890.
- Anthropic. "Building Effective Agents" (2024). Orchestrator-worker pattern.
- arxiv:2310.17389 — on CI reporting discipline in LLM evaluation.
