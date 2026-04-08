# nodebench-qa vs retention.sh — Gap Analysis

Cross-reference audit: 2026-04-08. Source: exhaustive read of both codebases.

## Summary

| Dimension | retention.sh | nodebench-qa | Coverage |
|-----------|-------------|-------------|----------|
| MCP tools | 120+ across 25 families | 6 tools | **5%** |
| API endpoints | 60+ route groups | 4 routes + health | **7%** |
| Frontend pages | 60+ pages | 3 pages | **5%** |
| Agent types | 15+ (coordinator, specialists, OAVR, PRD parser, QA emulation) | 1 working (pipeline), 1 scaffold (coordinator), 1 types-only (OAVR) | **7%** |
| CLI commands | 2 (analyze, hook) | 8 subcommands | **400%** (expanded) |
| Backend services | 40+ services | 0 (all inline) | **0%** |
| Integrations | 9 (Figma, Convex, Playwright, Slack, Telegram, OTel, LangSmith, Mobile MCP, NemoClaw) | 0 | **0%** |
| Packages | 5 (CLI, MCP knowledge, SDK, create-app, chef) | 8 crates (different architecture) | N/A |
| Algorithms | 10 core (exploration memory, OAVR, trajectory replay, compression, golden bugs, etc.) | 0 fully working | **0%** |
| Team features | Invites, shared memory, dashboard, signup, SSE broadcast | 0 | **0%** |
| Browser automation | Playwright (full: navigate, click, fill, screenshot, discover, health check) | HTTP fetch only (chromiumoxide dep unused) | **0%** |

---

## P0 — Critical Bugs (fix now)

### P0-1: API swallows all errors as HTTP 200
**Location:** `rust/crates/api/src/routes/qa.rs` lines 72-88, 96-108, 114-126, 132-140
**Problem:** Every handler wraps engine calls in `match` and returns `(score: 0, issues: 0)` on error. AI agents consuming these endpoints get false confidence — they see HTTP 200 and assume the check passed with score 0.
**Fix:** Return proper HTTP 4xx/5xx error responses. Use Axum's `IntoResponse` with status codes.
**Agentic reliability:** Violates HONEST_STATUS — "no 2xx on failure paths."

### P0-2: SDK auth token is dead code
**Location:** `rust/crates/sdk/src/lib.rs` line 24
**Problem:** `with_auth()` stores the token but no request method includes an `Authorization` header.
**Fix:** Add `.header("Authorization", format!("Bearer {}", token))` to all request methods when auth_token is Some.

### P0-3: CLI `serve --mcp` flag does nothing
**Location:** `rust/crates/cli/src/main.rs` lines 120-145
**Problem:** `--mcp` flag is accepted and port is printed, but `build_mcp_router()` is never composed into the served application. Only the API router runs.
**Fix:** Either merge MCP router into main app or spawn a second Tokio task serving on `mcp_port`.

### P0-4: Config file loading is broken
**Location:** `rust/crates/core/src/config.rs` line 115-118
**Problem:** `toml_from_str()` calls `serde_json::from_str()` on TOML content. Will fail for any real config file.
**Fix:** Add `toml` crate dependency and use proper TOML parsing.

### P0-5: Unsafe `set_var` in multi-threaded context
**Location:** `rust/crates/cli/src/main.rs` line 115
**Problem:** `unsafe { std::env::set_var() }` before tokio runtime is fully started. Rust 2024 made this unsafe because it's UB in multi-threaded programs.
**Fix:** Use `EnvFilter::builder().parse()` to set log level directly instead of modifying env vars.

---

## P1 — Structural Gaps (fix this sprint)

### P1-1: No browser automation whatsoever
**Impact:** The core product value — "QA your app" — is limited to HTTP-level HTML string matching. No JS execution, no console capture, no rendering verification, no screenshot capture, no real accessibility testing.
**retention.sh equivalent:** Full Playwright integration (navigate, click, fill, screenshot, discover, health check, interaction test, batch test).
**Fix:** Wire `chromiumoxide` (already in Cargo.toml) or add headless Chrome via `headless_chrome` crate. Minimum: launch browser, navigate, capture console errors, take screenshot.

### P1-2: 13/21 UX audit rules auto-pass
**Location:** `rust/crates/qa-engine/src/audit.rs` `_` match arm
**Problem:** Rules ux-04, 06, 07, 09, 10, 11, 12, 13, 14, 15, 17, 18, 19 always return `passed: true`.
**Fix:** Implement HTML-based heuristic checks for rules that can be checked without a browser (heading hierarchy, alt text counting, form labels, etc.). Flag truly-browser-only rules as "skipped" not "passed".

### P1-3: Workflow recording/replay is entirely scaffolded
**Location:** `rust/crates/qa-engine/src/workflow.rs`
**Problem:** `start_workflow()` returns a scaffold. `replay_workflow()` does arithmetic on all-zero token costs. No actual recording or replay.
**retention.sh equivalent:** Full trajectory replay with 60-70% token savings, exploration memory, workflow compression (4 layers), replay correctness policy.
**Fix:** Requires browser automation first (P1-1). Then: record browser actions as WorkflowSteps, persist to disk, implement cache-hit detection, replay cached steps.

### P1-4: Pipeline skips 2 of 6 stages
**Location:** `rust/crates/agents/src/pipeline.rs`
**Problem:** `TestGenerate` and `Execute` stages are absent. Pipeline runs Crawl → Analyze → Verify → Report, skipping test generation and execution.
**Fix:** Add test case generation (can be LLM-powered or rule-based) and execution against discovered pages.

### P1-5: diff_crawl API handler is stubbed
**Location:** `rust/crates/api/src/routes/qa.rs` `diff_crawl` handler
**Problem:** Returns `changes_detected: 0` always. Doesn't call the engine (which works). The MCP tool IS wired up — inconsistency.
**Fix:** Wire handler to `nodebench_qa_engine::diff::run_diff_crawl()`.

### P1-6: No baseline storage for diff crawl
**Location:** `rust/crates/qa-engine/src/diff.rs` line 56
**Problem:** `run_diff_crawl()` always compares against empty baseline. No persistence layer.
**Fix:** Add SQLite or file-based baseline storage. Save crawl snapshots with IDs, look up by baseline_id.

### P1-7: Results page shows static placeholder
**Location:** `frontend/src/pages/Results.tsx`
**Problem:** Only displays run ID and "Results will appear here." No data fetching, no result rendering.
**Fix:** Fetch results from `/api/qa/check` (need a GET endpoint by ID), render issues, scores, dimensions.

### P1-8: MCP server has no session management
**Problem:** Stateless JSON-RPC endpoint. No MCP session initialization handshake, no notification support, no resource/prompt capabilities.
**retention.sh equivalent:** Full MCP Streamable HTTP transport (spec-compliant), plus stdio transport.
**Fix:** Add session tracking, implement proper MCP lifecycle (initialize → initialized → tools/call).

---

## P2 — Missing Features (next sprint)

### MCP Tool Families (0/25 from retention.sh)

| Family | retention.sh Tools | nodebench-qa | Priority |
|--------|-------------------|-------------|----------|
| Pipeline (`ta.pipeline.*`) | 12 tools (run, status, results, rerun, failure_bundle, replay_gif, screenshot, run_log, list_apps, run_catalog, run_suite) | 1 (`nbqa.pipeline`) | HIGH |
| Memory (`ta.memory.*`) | 6 tools (check, graph, invalidate, stats, status, apps) | 0 | HIGH |
| Benchmark (`ta.benchmark.*`) | 12 tools (generate_app, list_cases, list_templates, model_compare, qa_pipeline, run_case, run_suite, score, scorecard, run_history) | 0 | MEDIUM |
| Feedback (`ta.feedback.*`) | 5 tools (annotate, list, package, summary) | 0 | MEDIUM |
| Savings (`ta.savings.*`) | 4 tools (breakdown, compare, forecast, roi) | 0 | MEDIUM |
| Compression (`ta.compress.*`) | 4 tools (workflow, list, rollback, stats) | 0 | MEDIUM |
| Checkpoint (`ta.checkpoint.*`) | 4 tools (set, list, verify, drift_report) | 0 | LOW |
| TCWP (`ta.tcwp.*`) | 6 tools (generate, validate, list, export, ingest, export_profile) | 0 | LOW |
| Audit (`ta.audit.*`) | 4 tools (list, compare, validate_shortcut, drift_report) | 0 | LOW |
| Device (`ta.device.*`) | 2 tools (list, lease) | 0 | LOW |
| Design (`ta.design.*`) | 4 tools (figma_snapshot, figma_analyze_flows, generate_from_design, pipeline) | 0 | LOW |
| Codebase (`ta.codebase.*`) | 18 tools (search, read, git_log, git_diff, write, analyze_ui_impact, etc.) | 0 | LOW |
| Web Demo (`ta.web_demo.*`) | 4 tools (discover, run, scorecard, status) | 0 | MEDIUM |
| Context Graph (`ta.graph.*`) | 10 tools | 0 | LOW |
| Linkage (`ta.linkage.*`) | 4 tools | 0 | LOW |
| Screenshot (`ta.screenshots.*`) | 3 tools | 0 | LOW |
| Judge (`ta.judge.*`) | 6 tools | 0 | LOW |
| NemoClaw (`ta.nemoclaw.*`) | 4 tools | 0 | LOW |
| Playwright (`ta.playwright.*`) | 8 tools | 0 | HIGH (core capability) |
| Investor Brief (`ta.investor_brief.*`) | 7 tools | 0 | LOW |
| Usage (`ta.usage.*`) | 2 tools | 0 | LOW |
| Slack (`ta.slack.*`) | 4+ tools | 0 | LOW |

### Integrations (0/9)

| Integration | retention.sh | nodebench-qa | Priority |
|-------------|-------------|-------------|----------|
| Playwright | Full browser automation | None | **P1** |
| Convex | Real-time DB + auth + agents | None | MEDIUM |
| Figma | Snapshot, flow analysis, code gen | None | LOW |
| Slack | Digest, drift, standup, memory | None | LOW |
| Telegram | Bot + webhook | None | LOW |
| OpenTelemetry | Trace ingestion | None | LOW |
| LangSmith | Observability | None | LOW |
| Mobile MCP/ADB | Device control + streaming | None | LOW |
| NemoClaw | Free-tier model rotation agent | None | MEDIUM |

### Frontend Pages (3/60+)

Implemented: Landing, Dashboard (basic), Results (stub)

Missing high-priority pages:
- Benchmark comparison
- Pipeline results viewer
- Agent chat interface
- Memory dashboard
- Device control
- Trajectory viewer
- QA pipeline demo
- Playground

### Algorithms (0/10)

| Algorithm | retention.sh | nodebench-qa | Priority |
|-----------|-------------|-------------|----------|
| Exploration Memory | Full (app fingerprint, cache layers) | None | HIGH |
| OAVR Cycle | Full (screen classifier, action verifier, failure diagnosis) | Types only | MEDIUM |
| Trajectory Replay | 60-70% token savings, verified | Scaffold (arithmetic only) | HIGH |
| Workflow Compression | 4 layers (dedup, stable path, CRUD shortcuts, checkpoint pruning) | None | MEDIUM |
| Replay Correctness Policy | 5 verdicts, escalation triggers | None | MEDIUM |
| Policy Learner | Correction recording, clustering, auto-propose | None | LOW |
| Golden Bug System | 10 deterministic test cases | None | MEDIUM |
| Context Graph | Verdict attribution, failure chains, precedents | None | LOW |
| ROP Dream Engine | Automated push trigger, lifecycle | None | LOW |
| GIF Replay | Screenshot stitching, overlays | None | LOW |

### Backend Services (0/40+)

Not applicable — retention.sh uses 40+ Python service files. nodebench-qa uses Rust crates with inline functionality. This is an architectural difference, not a gap. However, the capabilities those services provide are mostly missing.

---

## What nodebench-qa Does Better

1. **CLI is richer** — 8 subcommands vs retention's 2. Can serve, check, sitemap, audit, diff, pipeline, health, info directly.
2. **Type safety** — Rust's type system catches errors at compile time that Python misses at runtime.
3. **Performance potential** — Rust binary will be significantly faster than Python FastAPI once browser automation is wired up.
4. **MCP protocol implementation** — Clean JSON-RPC 2.0 with proper error codes. retention.sh's MCP has more tools but the protocol layer is comparable.

---

## Recommended Priority Order

### Sprint 1: Fix P0s (make what exists correct)
1. P0-1: Honest HTTP error responses
2. P0-2: SDK auth header
3. P0-3: Wire MCP server to CLI serve
4. P0-4: Fix TOML config parsing
5. P0-5: Fix unsafe set_var

### Sprint 2: Browser automation (unlock core value)
1. P1-1: Wire chromiumoxide for real browser QA
2. P1-2: Implement remaining UX audit rules
3. P1-7: Build results page

### Sprint 3: Trajectory replay (unlock differentiation)
1. P1-3: Workflow recording + persistence
2. P1-6: Baseline storage for diff crawl
3. Add exploration memory (retention.sh's key algorithm)

### Sprint 4: Agent orchestration
1. P1-4: Add TestGenerate + Execute pipeline stages
2. Wire coordinator to actually dispatch tasks
3. Implement OAVR runtime

### Sprint 5: Scale tools
1. Add pipeline family tools (status, results, rerun)
2. Add memory family tools
3. Add Playwright tool family
4. Expand frontend (benchmark, pipeline results, trajectory viewer)
