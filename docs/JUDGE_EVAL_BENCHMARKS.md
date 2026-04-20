# Public Benchmarks for DaaS Judge Eval Cycles

## Why this matters

The DaaS judge currently relies on an LLM applying a bounded boolean rubric. That catches hallucination and structural failures (as the FloorAI showcase proved), but it's still an LLM judging an LLM. For **ground-truth** verification we need public benchmarks with deterministic scoring — unit tests, exact match, AST comparison — that can run in our replay harness without any LLM in the loop.

This doc picks **5 public benchmarks** we can integrate today, ranked by impact-per-effort for the DaaS replay judge. Framing anchors on the [Vellum Opus 4.7 analysis](https://www.vellum.ai/blog/claude-opus-4-7-benchmarks-explained) that we agreed shifted our evaluation strategy from MMLU to workload-realistic benchmarks.

## Selection criteria

Every candidate must score on at least three:

1. **Ground-truth scoring** — unit tests, exact-match, AST comparison, not LLM judge
2. **Public dataset** — downloadable from HuggingFace or GitHub, permissive license
3. **Subset-runnable** — can run 10–50 tasks in minutes for fast iteration
4. **Replay-shaped** — input is a task + expected output, matching our trace→replay shape
5. **Active maintenance** — released or updated in the last 18 months

## The 5 benchmarks to integrate

### 1. SWE-bench Verified — real GitHub issues + unit tests

| Property | Value |
|----------|-------|
| **Scoring** | Deterministic — PASS/FAIL from FAIL_TO_PASS + PASS_TO_PASS unit tests in a Docker sandbox |
| **Size** | 500 human-verified tasks |
| **License** | MIT / open source |
| **Source** | [swebench.com/verified](https://www.swebench.com/verified.html) · [openai/introducing-swe-bench-verified](https://openai.com/index/introducing-swe-bench-verified/) |
| **Harness** | Official Docker harness; Python runner invokes tests against the patch |
| **Why** | Ground-truth code correctness. Used by Anthropic to measure Opus 4.7 (87.6% Verified). If a DaaS replay can pass SWE-bench with a distilled scaffold, the scaffold is demonstrably useful for real engineering. |

**Integration plan** (DaaS-specific):
- Treat each SWE-bench task as a canonical trace: `query = issue body`, `finalAnswer = golden patch`.
- Pro distills WorkflowSpec with workers like `BugLocator`, `PatchProposer`, `TestVerifier`.
- Replay runs workers, emits a unified diff, submits to the Docker harness.
- Judge reads `harness_result = { passed: [tests], failed: [tests] }` — no LLM needed.
- **Success metric**: Flash Lite + scaffold pass rate vs Pro solo pass rate, at what cost ratio.

**Effort estimate**: 2 days — the Docker harness is the heavy part. Use `princeton-nlp/SWE-bench_Verified` on HuggingFace; invoke Docker via the official runner.

---

### 2. τ²-Bench Verified — tool-agent-user retail + airline flows

| Property | Value |
|----------|-------|
| **Scoring** | Deterministic — DB state + expected-action match against the Sierra policy engine |
| **Size** | ~100 tasks per domain (airline, retail, telecom) |
| **License** | Apache 2.0 |
| **Source** | [sierra-research/tau2-bench](https://github.com/sierra-research/tau2-bench) · [amazon-agi/tau2-bench-verified](https://github.com/amazon-agi/tau2-bench-verified) (corrected tasks) · [HuggingFaceH4/tau2-bench-data](https://huggingface.co/datasets/HuggingFaceH4/tau2-bench-data) |
| **Harness** | Python simulator; tasks run against a mocked DB + policy engine; compares end-state and actions |
| **Why** | **This is the closest public proxy for FloorAI**. Retail customer-service flows, tool-agent-user interaction, measurable outcomes. Uses the same scaffold shape we already distill. |

**Integration plan**:
- Use the retail domain (airline is an easier fit; retail is the clearest FloorAI analog).
- Each task: user goal + mocked store DB. Canonical trace = expert agent transcript.
- Distill, replay with Flash Lite, let our scaffold drive the Sierra simulator.
- Judge checks `final_db_state == expected_state` and `actions == expected_actions`.
- **Success metric**: per-task pass rate + average cost per resolved ticket.

**Effort estimate**: 3 days — requires running the Sierra simulator as a connector target, which exercises the `connectorMode: "live"` code path we haven't shipped yet.

---

### 3. BFCL v3 — function calling (multi-turn, multi-step)

| Property | Value |
|----------|-------|
| **Scoring** | Deterministic — AST-level comparison of the function calls the agent emits vs the expected calls |
| **Size** | Thousands of tasks across single/multi/parallel/multi-turn categories |
| **License** | Apache 2.0 |
| **Source** | [gorilla.cs.berkeley.edu/leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) · [gorilla-llm/Berkeley-Function-Calling-Leaderboard](https://huggingface.co/datasets/gorilla-llm/Berkeley-Function-Calling-Leaderboard) |
| **Harness** | `pip install bfcl-eval` — invokes a model + compares tool calls via AST |
| **Why** | Our replay already produces tool-call sequences. BFCL's AST comparator is exactly the `tool-call parity` check the judge computes weakly today. Plug it in and the parity measurement becomes rigorous. |

**Integration plan**:
- Pull 50 tasks per category (expert-curated, live, multi-turn) = 200 eval points.
- Feed into our replay harness; each worker emits tool calls which we translate to BFCL's format.
- BFCL's AST comparator scores `exact call match` / `partial match` / `missed call`.
- **Success metric**: tool parity score, which directly validates the `covers_main_points` + `internally_consistent` rubric checks.

**Effort estimate**: 1 day — Python package already exists, mostly adapter work.

---

### 4. MMLU-Pro — reasoning pass rate (lightweight canary)

| Property | Value |
|----------|-------|
| **Scoring** | Deterministic — single-letter answer match |
| **Size** | 12,032 test / 70 validation |
| **License** | MIT |
| **Source** | [TIGER-Lab/MMLU-Pro](https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro) |
| **Harness** | Simple — pass prompt, extract answer letter |
| **Why** | Cheap, fast, stable. Use as a **canary** to detect rubric regressions: every rubric-registry change re-runs the same 50 MMLU-Pro questions to confirm the judge still catches wrong answers. Not a product benchmark. |

**Integration plan**:
- 50 questions sampled stratified by domain (business, law, psychology, engineering, health).
- Scaffold is a single `Answerer` worker — no orchestrator needed for MC questions.
- Judge uses exact-match on the extracted letter.
- **Success metric**: 0.5% accuracy drift between rubric revisions = no silent regression.

**Effort estimate**: 0.5 day — we already have `experiments/scaffolding_wedge/run_v3.py` that does this.

---

### 5. ReportBench — deep-research citation quality

| Property | Value |
|----------|-------|
| **Scoring** | Semi-deterministic — citation set overlap + factual-claim retrieval against expert survey papers |
| **Size** | Comprehensive benchmark targeting Deep Research agents |
| **License** | Permissive (ByteDance-BandAI) |
| **Source** | [ByteDance-BandAI/ReportBench](https://huggingface.co/datasets/ByteDance-BandAI/ReportBench) |
| **Harness** | JSONL with ground_truth reference arrays per sample |
| **Why** | Perfect substrate for the `grounded_in_context` + `no_hallucinated_ids` rubric checks. Our FloorAI showcase failed exactly on these; ReportBench gives us a public dataset where ground-truth citations exist and we can measure our boolean checks against truth, not just LLM verdict. |

**Integration plan**:
- Import a sample subset (start with 30 tasks, scale to 300 after validation).
- Pro distills a `ResearchSynthesizer` + `CitationVerifier` workflow.
- Replay emits a structured response with citations.
- Compare citations against the benchmark's `ground_truth` array.
- **Success metric**: citation precision + recall. Direct validation of `no_hallucinated_ids`.

**Effort estimate**: 2 days — custom citation extractor required.

---

## What we explicitly skip (and why)

| Benchmark | Reason to skip (for now) |
|-----------|--------------------------|
| GAIA | [UC Berkeley RDI](https://rdi.berkeley.edu/blog/trustworthy-benchmarks-cont/) found GAIA's scoring is exploitable; wait for a hardened version |
| HumanEval | Saturated — top models at 90%+, no signal for DaaS cost-vs-quality tradeoff |
| BrowseComp | Web research is a different product surface than distillation replay |
| LegalBench / FinanceBench | Narrow domains; revisit if we add a `daas.legal.v1` or `daas.finance.v1` rubric |
| Artificial Analysis Intelligence Index | Composite score, not something we can score against — useful as a downstream **target** |

## Integration priority

If we can only ship one this quarter, ship **BFCL v3** first — it's lowest-effort, and it directly validates the tool-call parity that the existing judge handles only weakly. After BFCL, **τ²-bench retail** because it's the closest analog to FloorAI and will stress the `connectorMode: "live"` code path we haven't exercised yet.

Ladder:

1. Day 1–2: BFCL v3 — 1 day to integrate, lands the quickest rigor improvement
2. Day 3–4: MMLU-Pro canary — 0.5 day, becomes a regression gate for every rubric change
3. Day 5–7: τ²-bench retail — validates the agent-flow shape against a real simulator
4. Day 8–10: SWE-bench Verified subset (20 tasks) — ground-truth unit-test path
5. Day 11–12: ReportBench — citation quality, completes the hallucination-catch story

Total: 12 working days to have 5 orthogonal ground-truth benchmarks wired into DaaS replay.

## Schema implication

The judge action currently takes a single replay and produces one judgment. To support benchmark harnesses we need:

- New table: `daasBenchmarkRuns` — records each benchmark-task execution + ground-truth result
- New action: `runBenchmarkSuite(benchmarkId, subsetSize)` — iterates tasks, dispatches to replay, scores deterministically
- Existing `daasAuditLog` already supports multi-op timelines

No frontend changes required until we want a benchmark dashboard. Start with CLI readout; add UI once we have 3 benchmark results flowing.

## Honest caveat

Benchmarks train what they measure. If we start judging DaaS solely on SWE-bench + BFCL we'll get scaffolds that optimize for those patterns. Always retain the rubric-based judge as the product surface — benchmarks become a **CI gate** for our rubrics, not a replacement for them.

---

## References

- [Vellum: Claude Opus 4.7 Benchmarks Explained](https://www.vellum.ai/blog/claude-opus-4-7-benchmarks-explained) — informed the strategy shift away from MMLU toward SWE-bench Pro / MCP-Atlas / Terminal-Bench
- [SWE-bench Verified (swebench.com)](https://www.swebench.com/verified.html)
- [τ²-bench verified (amazon-agi)](https://github.com/amazon-agi/tau2-bench-verified)
- [BFCL v3 blog](https://gorilla.cs.berkeley.edu/blogs/13_bfcl_v3_multi_turn.html)
- [TIGER-Lab MMLU-Pro](https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro)
- [ByteDance-BandAI ReportBench](https://huggingface.co/datasets/ByteDance-BandAI/ReportBench)
- [UC Berkeley RDI — how benchmarks break](https://rdi.berkeley.edu/blog/trustworthy-benchmarks-cont/) (why we picked ground-truth-scored benchmarks, not LLM-judged ones)
