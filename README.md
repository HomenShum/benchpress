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
