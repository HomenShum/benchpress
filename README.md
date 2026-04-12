# attrition.sh

**The always-on judge for AI agents.** Workflow memory + self-improving enforcement.

One command install. Invisible hooks fire on every prompt, tool call, and session stop. Every agent session is tracked, judged for completeness, and improved from corrections. Works with Claude Code, Cursor, OpenAI Agents SDK, LangChain, CrewAI, and any MCP-compatible agent.

## Quick Start

```bash
# Install (30 seconds, zero config)
curl -sL attrition.sh/install | bash

# That's it. Judge hooks activate automatically.
# Every session is now tracked and judged.

# View captured workflows
bp workflows

# Distill a frontier workflow for cheaper replay
bp distill <id> --target claude-sonnet-4-6

# Check judge corrections
bp judge --show-corrections
```

## How It Works

### 4-Hook Lifecycle

attrition.sh installs 4 hooks into your agent runtime. They fire automatically — no manual invocation.

| Hook | When | What |
|------|------|------|
| `on-session-start` | Agent starts | Resume incomplete workflows from prior sessions |
| `on-prompt` | User types prompt | Detect workflow patterns, inject required steps into context |
| `on-tool-use` | Each tool call | Track evidence, nudge when required steps are missing |
| `on-stop` | Agent tries to stop | Full completion judge — block if mandatory steps missing |

### Judge Verdicts

| Verdict | Action |
|---------|--------|
| `correct` | Allow stop. All required steps have evidence. |
| `partial` | Allow stop. Minor steps missing, logged for learning. |
| `escalate` | Strong nudge. >50% steps missing. Agent should continue. |
| `failed` | **Block stop.** <50% mandatory steps done. Lists missing steps. |

### Self-Improving (HyperAgents-Inspired)

Corrections feed back into workflow definitions. When the judge notices repeated patterns — "you forgot the search step" or "you skipped QA" — it tightens enforcement automatically. Inspired by [Meta's HyperAgents](https://hyperagents.agency/) DGM-H architecture: the judge improves its own improvement process.

```
Session → Judge scores completeness → Correction detected
    ↓                                        ↓
Workflow memory ← ← ← ← ← ← ← ← ← Tighten enforcement
    ↓
Next session → Better coverage → Higher scores
```

## Provider Agnostic

attrition.sh works with every major agent runtime:

| Runtime | Integration |
|---------|------------|
| **Claude Code** | Native hooks (PostToolUse, Stop, SessionStart, UserPromptSubmit) |
| **Cursor** | MCP server + rule injection |
| **Windsurf** | MCP server + rule injection |
| **OpenAI Agents SDK** | `TracingProcessor` for span-level tracking |
| **Anthropic SDK** | Monkey-patches `Messages.create` |
| **LangChain** | Callback handler |
| **CrewAI** | `@before_tool_call` / `@after_tool_call` decorators |
| **PydanticAI** | OTEL/logfire integration |
| **Any MCP client** | JSON-RPC `bp.judge.*` tools |

```python
# Python SDK — one line for any provider
from attrition import track
track()  # Auto-detects and patches your agent runtime
```

## Architecture

12-crate Rust workspace:

```
attrition/
  rust/crates/
    core/          Core types, config, error handling
    workflow/      Canonical event capture + SQLite storage
    distiller/     4-strategy workflow compression (40-65% reduction)
    judge/         Always-on judge engine (verdict + nudge + attention)
    llm-client/    Anthropic Messages API client
    api/           Axum HTTP API server
    mcp-server/    MCP protocol (12 bp.* tools)
    qa-engine/     Browser automation, crawling, UX audit
    agents/        Multi-agent orchestration
    cli/           CLI binary (bp), 11 subcommands
    telemetry/     Structured logging via tracing
    sdk/           Rust SDK client
  frontend/        React 19 + Vite + TypeScript
```

### Capture → Distill → Judge

```
  Agent session (any provider)
         |
    always-on hooks   --> Canonical events --> SQLite workflow memory
         |
    bp distill         --> Eliminate redundant steps (40-65%)
         |                 Extract copy-paste blocks
         |                 Compress reasoning
         |                 Insert checkpoints
         |
    judge (automatic)  --> Compare expected vs actual
         |                 Nudge on divergence
         |                 Block on failure
         |                 Learn from corrections
```

## MCP Tools (12)

| Tool | Description |
|------|-------------|
| `bp.judge.start` | Start judge session for workflow replay |
| `bp.judge.event` | Report actual event, get nudge if divergent |
| `bp.judge.verdict` | Finalize session, produce verdict |
| `bp.capture` | Parse session, save as replayable workflow |
| `bp.workflows` | List all captured workflows |
| `bp.distill` | Distill workflow for cheaper model replay |
| `bp.check` | Full QA check |
| `bp.sitemap` | Crawl + sitemap |
| `bp.ux_audit` | 21-rule UX audit |
| `bp.diff_crawl` | Before/after comparison |
| `bp.workflow` | Start workflow recording |
| `bp.pipeline` | Full QA pipeline |

## CLI Commands

| Command | Description |
|---------|-------------|
| `bp serve` | Start API + MCP server (judge hooks via HTTP) |
| `bp capture <path>` | Capture agent session as workflow |
| `bp workflows` | List all captured workflows |
| `bp distill <id>` | Distill workflow for cheaper model replay |
| `bp judge <id>` | Start judge session for replay verification |
| `bp check <url>` | Run QA check |
| `bp sitemap <url>` | Crawl and generate sitemap |
| `bp audit <url>` | 21-rule UX audit |
| `bp diff <url>` | Before/after comparison crawl |
| `bp pipeline <url>` | Full QA pipeline |
| `bp health` | Server health status |
| `bp info` | Version and system info |

## Development

```bash
cargo build --workspace          # Build all 12 crates
cargo test --workspace           # 87 tests
cargo build --release -p attrition-cli  # Release binary

bp serve --port 8100             # API + MCP
cd frontend && npm run dev       # Frontend on 5173
```

## Links

- **Website**: [attrition.sh](https://attrition.sh)
- **GitHub**: [github.com/HomenShum/attrition](https://github.com/HomenShum/attrition)
- **Inspiration**: [Meta HyperAgents](https://hyperagents.agency/) (self-improving agent meta-loop)

## License

MIT
## RETHINK REDESIGN APR 2026

### Why This Section Exists

We applied the same behavioral design principles that made Linear, Perplexity, ChatGPT, Notion, and Vercel feel premium — and found that both NodeBench and attrition.sh violate all five of them. This section is a permanent record of that audit and the execution plan.

### The 5 Principles We Violate

#### 1. VALUE BEFORE IDENTITY — time-to-wow < 5 seconds

**What premium products do**: ChatGPT has one text box. Perplexity has one search bar. Linear lets you create an issue in 3 seconds from Cmd+K. The first pixel IS the first action.

**What we do wrong**: Both products lead with explanation pages, competitive tables, feature cards, and navigation systems. The user must understand what we are before they can use us.

**Fix**: The first thing on screen must be the thing you do. For attrition: a scan input. For NodeBench: the Ask search bar. Everything else is below the fold.

#### 2. SPEED IS A FEATURE, NOT A METRIC

**What premium products do**: Linear renders in sub-50ms. ChatGPT streams responses so 3 seconds feels like watching someone think. Perplexity shows sources progressively.

**What we do wrong**: Attrition's chat panel has hardcoded fake delays. Cloud Run cold starts take 1-5s with no feedback. NodeBench's pipeline has no progressive streaming of answer sections. No skeleton loading on surface transitions.

**Fix**: Hard latency budgets — first visible response < 800ms, first source < 2s, first complete section < 5s. Progressive rendering, not batch reveals.

#### 3. THE OUTPUT IS THE DISTRIBUTION

**What premium products do**: Every ChatGPT conversation is a screenshot people share. Every Perplexity answer has a shareable URL with citations. TikTok watermarks videos for cross-platform sharing.

**What we do wrong**: Neither product generates shareable URLs for results. No screenshot-worthy artifact. No "send this to a colleague" moment.

**Fix**: Generate shareable result URLs (`/scan/:id`, `/report/:id`) that render without auth. Design result cards as screenshot-worthy single visuals.

#### 4. MEET USERS WHERE THEY ARE

**What premium products do**: Linear has Cmd+K everywhere. ChatGPT's absence of UI IS the UI. Products meet users in their existing workflow, not in a new navigation system.

**What we do wrong**: Attrition has 11 pages with 4+ nav tabs. NodeBench has 5 surfaces with sidebar + top nav + bottom nav. Users must learn a navigation system before getting value.

**Fix**: Make chat/search the primary surface. Everything reachable from one input. URL-based queries (`?q=` or `?scan=`) that skip all navigation.

#### 5. THE PRODUCT IMPROVES ITSELF

**What premium products do**: TikTok's algorithm gets better with every swipe. ChatGPT's memory makes later interactions more relevant. Notion AI fits into existing blocks.

**What we do wrong**: No visible learning in either product. The infrastructure exists (correction learner, Me context, workflow memory) but nothing in the UI says "I'm getting better for you."

**Fix**: Show "based on your previous N sessions" suggestions. Show correction learning visibly. Make returning users see personalized context that proves the product knows them.

### The Deeper Problem: Surface Sprawl

**attrition.sh**: 11 pages (Landing, Proof, Improvements, Get Started, Live, Workflows, Judge, Anatomy, Benchmark, Compare, Chat) for a product that does ONE thing — catch when agents skip steps. Should be 3 surfaces: scanner + chat + docs.

**NodeBench**: 5 surfaces (Ask, Workspace, Packets, History, Connect) plus Oracle, flywheel, trajectory, benchmark, and dogfood surfaces. The MCP server has 350+ tools across 57 domains. Should follow the Addy Osmani agent-skills pattern: each skill = ONE thing, ONE workflow.

### The MCP Bloat Problem

Both products have MCP tool registries that grew by accretion, not by design.

**NodeBench MCP**: 350+ tools, 57 domains, progressive discovery layers, analytics client, embedding index, dashboard launcher, profiling hooks — all in the boot path. Performance is self-benchmarked, not user-value-benchmarked.

**attrition MCP**: 12 tools where 6 would do. `bp.sitemap`, `bp.ux_audit`, `bp.diff_crawl`, `bp.workflow`, `bp.pipeline`, `bp.workflows` are sub-features of `bp.check` and `bp.capture`.

**What good looks like** (Addy Osmani's agent-skills):
- Each skill is ONE thing with ONE workflow
- README shows: what it does, how to use it, what you get
- No discovery layer — install what you want
- No 350-tool registry — 5 skills that each do 1 thing well

### Concrete Execution Board

| # | Principle | Fix | Metric to enforce | Ship order |
|---|-----------|-----|--------------------|------------|
| 1 | Value before identity | First pixel = input field, not explanation | Time from load to first action < 5s | Week 1 |
| 2 | Speed as feature | Progressive rendering, remove fake delays, hard latency budgets | First visible result < 800ms | Week 1 |
| 3 | Output = distribution | Shareable result URLs, screenshot-worthy cards | Every result has a shareable URL | Week 2 |
| 4 | Meet users where they are | Chat/search as primary surface, collapse nav | User can do everything from one input | Week 2 |
| 5 | Product improves itself | Visible learning, personalized suggestions | Returning user sees context from prior sessions | Week 3 |
| 6 | MCP discipline | Reduce to core tools, one workflow per skill | attrition: 6 tools. NodeBench: skill-based, not registry-based | Week 3 |

### Root Causes (from competitor analysis)

1. **One dominant job per screen** — Notion frames the problem as software sprawl. The fix is subtracting tools, not adding surfaces.
2. **Trust comes from visible reasoning, not decorative UI** — Linear and Perplexity build trust through transparent reasoning and cited sources, not bordered cards.
3. **Speed is product behavior, not backend optimization** — If it takes >200ms, make it faster. Premium feel comes from response cadence and zero hesitation.
4. **Quality is a system, not a cleanup sprint** — Linear has Quality Wednesdays (1,000+ small fixes) and zero-bugs policy (fix now or explicitly decline).
5. **The product gets more useful as it knows more context** — ChatGPT memory, Notion AI in existing blocks, Perplexity exportable artifacts.

### Quality Operating System (from Linear)

Without a permanent quality lane, the UI will drift back into inconsistency.

- **Weekly**: papercut pass — motion, spacing, hover, focus, empty-state review
- **Per-push**: no bug backlog dumping — bugs are fixed now or explicitly declined
- **Instrumented**: time-to-value metrics, not just render counts
  - `ask_submitted_at`
  - `first_partial_answer_at`
  - `first_source_at`
  - `first_saved_report_at`
  - `first_return_visit_at`

### The One-Line Version

**Both products should feel like Perplexity for their domain: one input, one answer, shareable results, visibly getting smarter.**

Not: multi-surface dashboards with competitive comparison tables and 350-tool registries.

### References

- [Linear on speed + transparent reasoning](https://linear.app)
- [Perplexity answer engine model](https://perplexity.ai)
- [Notion on software sprawl](https://notion.so)
- [Vercel virtual product tour](https://vercel.com)
- [ChatGPT memory + connected apps](https://openai.com)
- [Addy Osmani agent-skills](https://github.com/addyosmani/agent-skills)
- [Meta HyperAgents](https://hyperagents.agency/)
- [Linear Quality Wednesdays](https://linear.app/blog)
- [Linear Zero-bugs policy](https://linear.app/blog)
- Full audit: `docs/BEHAVIORAL_DESIGN_AUDIT.md`

### Three-Product Stack (Apr 2026)

```
NodeBench AI   = flagship user surface
nodebench-mcp  = embedded workflow lane
Attrition.sh   = measured replay + optimization lane
```

Attrition is NOT a third flagship. It is the measurable optimization lane for the same NodeBench workflow. One job: capture, measure, compress, replay, prove savings.

Full spec: `docs/THREE_PRODUCT_STACK_SPEC.md`
