# attrition.sh — Product Vision, Mission, Pitch

## The company in one line

**attrition.sh is the agent architecture compiler and verification layer.**

It turns successful agent workflows into portable, judged runtime assets that
can be compiled **down** into cheaper paths, compiled **up** into richer
orchestrator-worker systems, or **translated** across agent SDKs and frameworks.

## The one problem

Transferring tacit judgment from model inference into externalized structure
without losing fidelity — and knowing when you can't.

## Vision

A world where no company is trapped inside the first agent architecture it shipped.
Frontier-model runs should become reusable workflow assets, not expensive one-off
miracles. Legacy chains should not be dead ends. Every business workflow should
be portable across model tiers, tool stacks, and orchestration styles, with
measured proof of what survived the translation.

## Mission

Turn successful agent workflows into portable, verified runtime assets.

attrition.sh helps teams **capture** how an expensive or legacy agent solved a
task, **distill** that behavior into a canonical workflow spec, **generate** the
target runtime they actually want, **replay** it on cheaper or alternate models,
and **verify** what passed, what regressed, and what still needs the stronger model.

## The three motions

| Motion | From | To |
|---|---|---|
| **Compile down** | Expensive orchestrator-worker runtime | Cheaper chain/tool/runtime path |
| **Compile up** | Legacy chain / prompt stack | Richer orchestrator-worker scaffold |
| **Translate across** | One framework/runtime | Another, with regression evidence |

## Why customers buy it

A production engineer does not usually want the fanciest agent. They want the
simplest thing that passes. attrition.sh speaks directly to real operational pain:

- "We already have a strong but expensive agent. Can we turn repeated workflows into cheaper production paths?"
- "We already have a cheap chain-based system. Can we safely upgrade to a richer scaffold without regression?"
- "We built one version in one stack. Can we port it to another without rewriting it from scratch?"
- "Can you show me the judged cost/fidelity tradeoff before I bet my team on a migration?"

## The product surfaces — three pages only

### Page 1 — ARCHITECT (`/`)

Chat-first intake. User describes a workflow or business problem. While the
classifier streams, a live animated checklist fills in:

- Problem type identified
- Output contract extracted
- Tools / MCP likely needed
- Existing assets detected
- Source-of-truth status resolved
- Eval method selected
- Runtime lane chosen
- World-model maturity chosen
- Interpretive boundary marked
- Missing inputs identified

Ends with a three-card recommendation receipt:

1. **Runtime**  — simple chain · tool-first chain · orchestrator-worker
2. **World model** — lite · full
3. **Proof / eval** — deterministic oracle, boolean rubric, benchmark replay

### Page 2 — BUILDER (`/build/:sessionId`)

Lovable-style split view. Left: chat / clarifications. Right: tabbed workspace.

- **Scaffold** — workflow graph, orchestrator, workers, tools, files, connector mode
- **Eval** — baseline / ceiling / distilled, deterministic checks, rubric, cost delta, regressions, routing rules
- **World Model** — entities, state, events, policies, actions, outcomes, evidence, interpretive boundary labels

### Page 3 — RADAR (`/radar`)

Normalized architecture intelligence. Not "AI news." Each item reduces to:
what changed → which stacks → what to do about it.

Subsections: **Releases** · **Benchmarks** · **Patterns** · **Deprecations** · **Watchlist**

Source hierarchy:
- Tier 1 (source of truth): official changelogs, docs, GitHub releases, benchmark pages
- Tier 2 (trusted interpreters): Vellum writeups, vendor launch blogs
- Tier 3 (weak signals): Hacker News, X, discourse

Watchlist (seeded): Claude Code · OpenAI Agents SDK · LangChain/LangGraph ·
Google ADK · DeerFlow · Hermes Agent · MCP ecosystem · benchmark trackers.

Radar writes into three internal registries that feed the product:

- **Runtime priors** — adjust recommender when frameworks add memory/sandboxes/graph ergonomics
- **Eval priors** — update judge/eval plan when benchmark quality shifts
- **World-model priors** — suggest richer substrates when new collaborative patterns appear

## The two-axis decision matrix

| Runtime | World model | When to recommend it |
|---|---|---|
| Simple chain | Lite | Bounded report generators, summarizers, deterministic lookup |
| Simple chain | Full | Operationally simple but live-state + policy + outcome tracking needed |
| Orchestrator-worker | Lite | Exploratory prototypes, research-heavy tasks, "show me the richer version" |
| Orchestrator-worker | Full | Operational agents that read, decide, write, escalate, must be auditable |

## Ready-made world model — what attrition generates

```
/world-model
  entities.yaml              # customers, stores, tickets, invoices, products, regions, brokers
  states.schema.ts           # current facts and live status
  events.schema.ts           # what changed and when
  policies.yaml              # rules, thresholds, constraints
  actions.ts                 # what the agent is allowed to do
  outcomes.table.ts          # what happened after action
  evidence_refs.json         # source citations per claim
  interpretive_boundary.md   # act-on-this vs interpret-this-first labels
```

The interpretive boundary is critical. Every generated output must be labeled:

- **Act on this** — factual, verified, low-risk (status rollups, dependency flags)
- **Interpret this first** — judgment calls (trends, correlations, prioritization suggestions)

This is how attrition avoids the "quiet failure" mode where plausible interpretations
masquerade as settled operational truth.

## The honest promise

We do **not** promise every frontier workflow can be distilled into a cheap model.

We **do** promise attrition.sh will tell you:
- whether there is a real capability gap to distill
- whether externalized structure closes that gap
- how much fidelity survived
- what the replay costs
- what regressed
- when to stop pretending and keep the big model in the loop

That honesty is part of the product, not a disclaimer.

## Eval stack we run behind the scenes

| Layer | Benchmarks |
|---|---|
| **Judge calibration** | JudgeBench + IF-RewardBench |
| **Tool / MCP scaffolds** | BFCL v4 + MCP-Atlas |
| **Retail / policy flows** | τ²-bench + internal gold set with human-labeled per-check pass/fail |
| **Coding scaffolds** | SWE-bench Verified + Terminal-Bench 2.0 |
| **Research / browsing** | BrowseComp |
| **Open-ended sanity** | Arena-Hard-Auto · MT-Bench (position/verbosity bias flagged) |
| **Reward model / jury** | RewardBench 2 + PoLL panel-of-smaller-judges pattern |

Never let a single LLM judge be the only authority for a shipping decision.
Deterministic oracles first; small jury for residual open-ended cases.

## Homepage hero copy

> **Describe your workflow.** attrition will tell you what runtime to use,
> what world model you need, and what changed in the agent ecosystem since
> yesterday.

## What not to say

Do not say:
- "We replace Claude Code."
- "We make small models as good as big models everywhere."
- "We always distill frontier capability into cheap chains."

Say:
- "We identify where structure can replace model cost."
- "We translate workflows across architectures with regression evidence."
- "We know when not to distill."

## Ship order (phased)

**Phase 1.** Chat intake + animated checklist + recommendation receipt (Architect).
This prevents wasted compute and teaches the user what attrition is.

**Phase 2.** Accepted recommendation → Builder workspace with static generated
plan (scaffold files, workflow graph, required inputs, eval plan). Don't auto-run.

**Phase 3.** Judged replay and live observability. Once the user provides
traces/repo/connectors, generate and run. Results land in Builder's Eval tab
and update the recommendations on Architect.

**Phase 4.** Radar ingestion live from Tier 1 sources, feeding runtime/eval/world-model priors.

## Related docs

- `docs/FIDELITY_SYSTEM.md` — the 3-measurement template that backs every eval claim
- `docs/JUDGE_EVAL_BENCHMARKS.md` — the public benchmark stack and why each was chosen
- `docs/BFCL_FALSIFICATION_FINDINGS.md` — the discipline that produced the CI / Newcombe rules
