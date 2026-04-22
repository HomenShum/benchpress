# attrition architecture deep dive

Answers the multi-part architecture + runtime + eval + caching + demo
scaling question in one doc.

---

## 1. Role of each reference system in attrition

attrition is **not** another agent runtime. It's the compiler and
verification layer that sits **between** agents. So every system below
is either (a) an inspiration for what we EMIT, (b) a TARGET we emit to,
(c) infrastructure we RUN ON, or (d) out-of-scope today.

| System | Attrition's relationship | Used as |
|---|---|---|
| Claude Code / Claude Agent SDK | INSPIRATION + TARGET | Tool permissioning, MCP, subagents, context compaction patterns — we emit scaffolds that carry these. We ingest JSONL traces from it. |
| Manus (task/object UX, files, connectors) | UX INSPIRATION | Builder page Lovable-shape = Manus-style task/file/connector visibility. Sources tab came from this. |
| OpenClaw / cloud-browser / computer-use | TOOL RUNTIME ONLY (not state) | If a user's trace uses browser tools, we emit them as tool entries in `tools.py`. We do NOT store browser state as our source of truth. |
| DeerFlow / Hermes graph fanout | REFERENCE for planner-worker | Our `orchestrator_worker` emit lane copies the plan-dispatch-compact shape. We do NOT make LangGraph-style graphs our product's core model. |
| Convex | DURABLE BRAIN | Sessions, classifications, scaffold status, reactive streams. Every user state change flows here. |
| Vercel AI SDK | FACE / VOICE (indirect) | We stream Convex reactive queries to the UI — same user-visible property (progressive responses) without the SDK dependency. |
| LangGraph | DEEP-WORK EMIT TARGET | We emit `langgraph_python` as one of five runtime lanes. Not our own spine. |
| OpenAI / Google / Anthropic | TARGET PROVIDERS + INTERNAL JUDGES | Emit targets for scaffolds. Gemini Flash Lite = internal baseline; Gemini Pro = internal rubric judge. |
| OpenRouter | NOT WIRED YET | Candidate switchboard for letting users swap providers on the emitted scaffold. Roadmap. |

**The product invariant**: notebook / report artifact = the thing the
user keeps. For attrition that artifact is the **runnable scaffold ZIP
+ eval verdict CSV**. Everything else is UX around surfacing that.

---

## 2. Fast vs slow — should they share runtime?

### The two paths today

```
FAST (<2s end-to-end)                   SLOW (10-60s end-to-end)
----------------------                  -----------------------
Architect classify                      Architect classify
  1 Convex mutation                       1 Convex mutation
  1 Gemini Flash Lite call                1 Gemini Flash Lite call
  -> recommendation card                  -> recommendation card
                                                  │
                                                  ▼
                                        User clicks "Build this"
                                          1 emit call (Python, 0 network)
                                          N eval Gemini calls (20-50)
                                          -> EVAL_VERDICT + 9-layer ZIP
```

### Decision: SAME runtime, different EXIT points

Both paths use the same spine — Architect session, Convex reactive
stream, same normalizer for trace input, same WorkflowSpec pivot.
Fast-path simply EXITS after the classifier. Slow-path continues
through emit + evaluation.

### Tradeoffs

| Dimension | Single shared runtime | Split (fast ≠ slow) |
|---|---|---|
| Complexity | One pipeline, one set of tests | Two pipelines to keep in sync |
| Consistency | Same trace -> same spec in both modes | Drift risk |
| Latency budget | Fast must fit under single Convex action timeout (~10s) | Fast can be aggressively tuned |
| Eval parity | Fast doesn't have a gate today; adding one is trivial | Two evals to maintain |

**Current choice: SHARED spine**, because: (a) the meta-workflow
distillate is the same, (b) drift between fast and slow would
invalidate the "transfers" verdict the gate depends on, (c) cheap to
keep one pipeline given mostly-deterministic emit.

### Is fast "too dumb"?

Yes, if fast only returns the classifier output without any grounded
response. Two mitigations, both queued:

1. **Warm-cache fast path** — if the prompt matches a prior session's
   normalized entity, return that session's classification immediately
   (no Gemini call).
2. **Tier-up to slow without blocking** — fast returns immediately,
   then a background slow-run fills the same session with a full
   verdict which the user can revisit when they return.

---

## 3. Shared cache under demo-day load (100 concurrent users)

### The problem

100 users at a conference almost certainly search overlapping
entities (Anthropic, Stripe, OpenAI, the founder in the session they
just saw). Naively each hits the classifier + eval independently —
wasted tokens, slow, and annoying.

### The shape of the cache

Two-tier: **canonical-source cache** (public, shared, keyed by entity
slug) + **session-local state** (private, per-user).

```
┌──────────────────── CANONICAL SOURCE CACHE (Convex) ──────────────┐
│  Key: normalized_entity_slug  (e.g. "stripe", "anthropic", etc.)   │
│  Value:                                                           │
│    {                                                              │
│      last_fetched_at: 2026-04-21T18:22:00Z,                      │
│      source_snippets: [ {text, url, tier} ],                     │
│      distilled_meta_workflow: <compact digest>,                  │
│      evaluations: {                                              │
│        baseline_verdict: "...",                                  │
│        scaffold_verdict: "...",                                  │
│        ran_at: ...                                               │
│      }                                                            │
│    }                                                              │
│  TTL: 4 hours (configurable per entity kind)                      │
│  LRU: evict when >= 10k entries                                   │
└───────────────────────────────────────────────────────────────────┘

            ▲                                    │
            │ read                                │ write on first-run
            │                                    ▼

┌──────────────── PER-SESSION STATE (Convex, private) ──────────────┐
│  session_slug -> {                                                │
│    owner_token (localStorage),                                    │
│    prompt,                                                        │
│    transcriptJson,                                                │
│    runtimeLane,                                                   │
│    eval_verdict,                                                  │
│    reference_entity_slugs: ["stripe", ...],  <- FKs to canonical  │
│    event_id: "demo-day-2026-04-21"                                │
│  }                                                                │
└───────────────────────────────────────────────────────────────────┘
```

### Privacy + security

- Public-entity cache ONLY contains non-personal data: company name,
  public URL snippets, our own eval verdicts on public test subsets.
- Any user-pasted file content, trace JSONL, API keys → session-only,
  never written into the canonical cache.
- Canonical cache read is unauthenticated (public endpoint with
  rate-limit shield). Session writes require owner token.
- `daas/compile_down/_redact_secrets.py` already redacts long-token
  patterns (GCP, OpenAI, Anthropic, GitHub PAT) from anything that
  could leak into public results.

### Cost model at demo-day load

Without cache: 100 users × 28 Gemini calls = 2,800 calls. $8.40 for
one hour of conference.
With cache + 70% hit rate: 100 users × 28 × 0.30 = 840 calls. $2.52.
**>3× spend reduction at zero quality cost.**

### Better search for both profiles

Fast: returns cache hit + confidence. Miss -> classifier + write to
cache in background.
Slow: reads cache → if fresh enough for the user's latency tolerance,
skip fetch; else refresh. Both modes surface "cached 38 min ago" so
users see what they're getting.

---

## 4. Tying reports to events / days

### Why

Demo-day users benefit from seeing "today's sessions from this event"
separate from "all my sessions ever." Also helps with cost attribution
per event, follow-up emails, and the organizer's retrospective.

### Shape (Convex schema extension)

```
sessions (existing):
  sessionSlug  string PK
  ownerToken   string
  prompt       string
  transcriptJson  string
  classificationJson  string
  event_id     string?   <-- new
  created_at   number
```

`event_id` derivation:
1. If the URL carries `?event=demo-day-2026-04-21`, write it.
2. If the prompt mentions a known event phrase ("YC Demo Day",
   "AI Engineer Europe"), auto-tag via regex.
3. If neither, fall back to day-bucket (`day-2026-04-21`).

### UX surface

- **Architect's Recent sessions panel** already exists (localStorage).
  Add a collapsible "Event" header: "Demo Day Apr 21 · 7 sessions".
- **Builder** shows "Event: demo-day-2026-04-21" chip above the
  recommendation card.
- **Radar** unchanged.

### Local context gathering

Per event_id, cache the union of entity_slugs touched during that
event. When a user in the same event asks a new question, the
classifier warm-starts with "today's event has already looked at
these 14 entities" — meaningful recall without cross-event privacy
leaks.

---

## 5. ASCII runtime diagram — frontend / backend / database / services

```text
┌─────────── FRONTEND (Vercel SPA, Vite + React) ───────────────────┐
│                                                                   │
│  /        Architect     TraceDropzone   PromptTextarea             │
│  /build   Builder       EvaluationGateBanner  downloadBundleAsZip  │
│  /radar   Radar         ARCH_WATCH_LIST       FALLBACK_ITEMS       │
│                                                                   │
│  localStorage: owner_token, recent_sessions, event_id             │
└───────────────┬──────────────────────────────┬────────────────────┘
                │ WebSocket (Convex reactive) │ HTTPS emit / eval
                ▼                              ▼
┌────── CONVEX (durable brain) ────┐  ┌──── CLOUD RUN (Python) ─────┐
│                                  │  │                              │
│  domains/daas/architect          │  │  daas.compile_down.emit       │
│    classifier   (Gemini call)    │  │    per-lane emitters          │
│    session CRUD                  │  │    9-layer finalizer          │
│    owner-token auth              │  │                              │
│    event_id bucket               │  │  daas.benchmarks.*            │
│                                  │  │    scaffold_runtime_fidelity   │
│  domains/daas/radar              │  │    scaffold_broadened          │
│    items feed                    │  │    csv_eval_harness            │
│                                  │  │                              │
│  ── NEW ──                       │  │  rate_limit.py (60 RPM / IP) │
│  canonical_source_cache          │  │                              │
│    entity_slug PK                │  │                              │
│    TTL 4h, LRU 10k               │  │                              │
│                                  │  │                              │
└──┬───────────────────────────────┘  └────────────────┬─────────────┘
   │                                                    │
   │ outbound LLM / search                              │ emit-time 0 net
   ▼                                                    ▼
┌──────── AI PROVIDERS (emit target + internal judge) ─────────────┐
│  Gemini Flash Lite  — internal baseline, Architect classifier    │
│  Gemini Pro         — internal rubric judge (JSON-mode)          │
│  OpenAI / Anthropic / OpenRouter  — user-picked emit targets     │
│  Search APIs (Linkup, Brave, Tavily) — cached via canonical layer│
└───────────────────────────────────────────────────────────────────┘
```

### The journey of one fast request

```
user types        Convex         classifier     Gemini Flash Lite
  "Stripe"  ───▶  sessions   ──▶  action     ──▶  (200 ms)
                    │                │                │
                    │                │                │
                    ▼                ▼                ▼
              check canonical   cache HIT? return    cache MISS?
              cache (Stripe)    immediately          classify + WRITE
                                                      to canonical
                                                          │
                                                          ▼
                                             render recommendation card
```

Total wall clock on cache hit: ~250ms end-to-end.
Total wall clock on cache miss: ~1.8s end-to-end.

### The journey of one slow request

```
user clicks       Cloud Run      emit        bundle ZIP       Gemini
"Build this" ───▶ pipeline  ───▶ Python ───▶ (17 files)   ───▶ eval path
                    │                │             │             │
                    │                ▼             ▼             ▼
                    │           ast.parse    finalize      28 live calls
                    ▼           all .py      9 layers      ($0.003)
              rate-limit                                        │
              shield                                            ▼
                                                          write verdict
                                                          to session
                                                          unlock download
```

Total wall clock: 10-30s depending on cache hits on the eval path.

---

## 6. Just-in-time speed with fresh context

Three load-bearing moves:

1. **Pre-warm at event start** — an admin endpoint that bulk-fetches
   the 30 most-likely-searched entities (user-provided list) into the
   canonical cache. Runs in 20s; every subsequent user in that event
   window hits the warm cache.
2. **Streaming progressive response** — classifier writes each
   checklist step to the Convex session as it completes; UI's reactive
   query streams steps in as they land. User sees "step 3/10 ✓"
   within 400ms instead of waiting for the full 2s.
3. **Pre-emit scaffold shell during classifier** — once the
   classifier returns `runtimeLane`, fire the emit pipeline in
   parallel with the user reading the recommendation card. By the
   time they click "Build this", the bundle already exists in the
   Cloud Run response cache.

None of these three require ripping the architecture — they're
layered on top of today's spine.

---

## 7. What to ship as a CSV eval template (attrition-flavored)

See `daas/benchmarks/fast_slow_eval_template_v3.csv` (new file) for an
expanded template that:

- **Doubles the row count** from 60 → 120 to cover more attrition-
  specific scenarios (trace upload, repo-connect, cross-session
  recall, shared-cache hit, demo-day event tagging).
- **Keeps 9 boolean gates** (entity_correct, grounded_to_sources,
  factually_accurate, no_hallucinations, actionable,
  latency_within_budget, artifact_decision_correct, memory_first,
  tool_ordering_correct), and adds 2 attrition-specific gates:
  - `compile_down_preserved` — did the emitted scaffold pass the
    fidelity gate vs baseline?
  - `cache_hit_or_honest_miss` — did the shared cache hit, or did
    the miss produce a fresh write?
- **Every rationale column is required to be a short prose sentence**,
  not a number. The harness already enforces this.
