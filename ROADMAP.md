# attrition.sh — Roadmap

## Core Principle
Every push answers: **"What painful thing became newly reliable, newly visible, or newly cheaper this week?"**

## Pain Ladder
1. Agent says "done" too early
2. User cannot see what actually happened
3. Repeated workflows cost too much
4. Cheaper replay is hard to trust
5. Team knowledge lives in prompts and one person's head

---

## Release 1: Workflow Judge (NOW)
- [x] Checklist-based completion scoring
- [x] Hard gates (block incomplete work)
- [x] Verdict enum (correct/partial/escalate/failed)
- [x] Missing-step display
- [x] 4-hook lifecycle (on-prompt, on-tool-use, on-stop, on-session-start)
- [x] Install script (`curl -sL attrition.sh/install | bash`)
- [ ] Flagship workflow benchmark (1 real CSP-level task)
- [ ] Savings shown only with strict judge verdicts

**Message:** "The agent thought it was done. attrition showed exactly what was missing."

## Release 2: Run Anatomy (Week 2)
- [ ] Tool timeline visualization
- [ ] Per-step cost/time breakdown
- [ ] Nudge events in timeline
- [ ] Artifacts + screenshots
- [ ] Run comparison view (same task, different runs)

**Message:** "See exactly what your agent did, what it missed, and what it cost."

## Release 3: Cheap Replay (Week 3-4)
- [ ] Frontier vs replay compare
- [ ] Savings waterfall chart
- [ ] Strict verdict side-by-side
- [ ] Copy-paste block highlighting
- [ ] Checkpoint verification UI

**Message:** "Run once on Opus. Replay forever on Sonnet. Judge proves it's correct."

## Release 4: Retention API (Week 5-6)
- [ ] Canonical event schema (stable v1)
- [ ] Workflow package format (import/export)
- [ ] Adapter interface (pluggable runtime support)
- [ ] Shared retention endpoint
- [ ] Personal workflow memory

**Message:** "Retention is not a Claude Code trick. It's a workflow intelligence layer."

## Release 5: Cross-Runtime (Week 7-8)
- [ ] One non-Claude adapter (Cursor or OpenAI Agents)
- [ ] Provider comparison benchmark
- [ ] Runtime-agnostic event normalization
- [ ] SDK coverage for all 7 providers

**Message:** "Works everywhere your agents work."

## Release 6: Distillation Audit (Week 9-12)
- [ ] Paid service wrapper
- [ ] Benchmark pages with trace links
- [ ] Cloud dashboard for teams
- [ ] Workflow library
- [ ] Design partner onboarding flow
- [ ] Strict source labeling (live vs offline vs estimated)

**Message:** "Use frontier models for discovery once. Use attrition to make the repeatable parts cheaper and safer."

---

## Push Cadence
- **Daily:** benchmark run, regression check, one truth audit
- **Tuesday:** visible product improvement
- **Friday:** benchmark or judge reliability improvement
- **Every 2 weeks:** named milestone release
- **Monthly:** one market-facing proof artifact

## Each Release Contains
1. One capability change
2. One visibility change
3. One metric change
4. One limitation note

---

## Real Session Stats (Dogfood)

This roadmap was produced during the session that built attrition.sh itself:

| Metric | Value |
|--------|-------|
| Model | claude-opus-4-6 |
| Tool calls | 536 |
| Corrections needed | 1 |
| Completion | 8/8 steps |
| Files created | 120+ |
| Rust crates | 12 |
| Tests | 87 |
| Frontend pages | 10 |
| MCP tools | 12 |

**The agent completed 8/8 workflow steps with only 1 correction.** This is the kind of data attrition.sh will capture, score, and use to improve every future session.
