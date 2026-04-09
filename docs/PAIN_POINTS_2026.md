# Real Pain Points — AI Agent Workflow Failures (2026)

Scraped from GitHub issues, Medium articles, dev forums, and industry reports. These are the exact problems attrition.sh solves.

## 1. Agent Stops With Unfinished Work

**Source:** [anthropics/claude-code#1632](https://github.com/anthropics/claude-code/issues/1632)
> "Claude Code will often stop after a task, forgetting it has unfinished TODOs, and you have to remind it to keep going"
> — User had 10 TODOs, agent completed 3 and declared victory

**attrition fix:** Stop hook checks TODO completion before allowing agent to stop.

## 2. Agent Skips Explicit Instructions

**Source:** [anthropics/claude-code#24129](https://github.com/anthropics/claude-code/issues/24129)  
> "Claude selectively completed only the easy parts and skipped the rest without asking"
> — User gave 5 explicit requirements. Claude did 2, skipped 3 (PDF parsing, CSV, specific data sheets).

**attrition fix:** on-prompt injects all required steps. on-stop blocks if steps have no tool-call evidence.

## 3. Premature Completion (Says "Done" Too Early)

**Source:** [anthropics/claude-code-action#599](https://github.com/anthropics/claude-code-action/issues/599)
> "Claude Code terminates prematurely without completing all todos in the todo list"
> — Agent stopped after 5 of 10 todos, skipped format checking, linting, type checking, PR creation.

**attrition fix:** Judge tracks step completion. Verdict: FAILED if <50% mandatory steps done.

## 4. Context Loss In Long Sessions

**Source:** [DEV Community article](https://dev.to/kiwibreaksme/claude-code-keeps-forgetting-your-project-heres-the-fix-2026-3flm)
> "Claude Code keeps forgetting your project"
> — MIT Technology Review calls it the "Context Loss Problem": LLMs forget what they were doing in longer tasks.

**attrition fix:** on-session-start resumes incomplete workflows from prior sessions. Memory persists.

## 5. 70% Token Waste

**Source:** [Morph LLM cost analysis](https://www.morphllm.com/ai-coding-costs)
> "A developer tracking token consumption across 42 agent runs found that 70% of tokens were waste"
> — Agent read too many files, explored irrelevant code paths, repeated searches.

**attrition fix:** Distillation eliminates redundant steps. 45% average compression on replay.

## 6. $500-2000/Month API Costs

**Source:** [Morph LLM pricing report](https://www.morphllm.com/ai-coding-costs)
> "Developers using Claude Code as an agent report $500-2000/month in API costs"
> — Each call includes full conversation history. Sessions reach 200K tokens per call by the end.

**attrition fix:** Replay distilled workflows at 60-70% lower cost on cheaper models.

## 7. Stop Hook Is The Known Solution

**Source:** [Medium/Coding Nexus](https://medium.com/coding-nexus/claude-code-stop-hook-force-task-completion-before-claude-stops-4ded76215d17)
> "Claude Code Stop Hook: Force Task Completion Before Claude Stops"
> — Article describes manually building stop hooks to prevent premature completion.

**attrition fix:** We ARE the stop hook. One install command. No manual hook authoring.

## 8. CLAUDE.md Not Enough

**Source:** [AI Weekender](https://aiweekender.substack.com/p/claude-code-keeps-forgetting-your)
> "Claude Code Keeps Forgetting Your Stack. These 5 Files Fix That."
> — Community workaround: write CLAUDE.md, .cursorrules, AGENTS.md. Manual, fragile, not enforced.

**attrition fix:** CLAUDE.md remembers preferences. Attrition ENFORCES workflow steps.

## 9. Cursor Stops Mid-Completion

**Source:** [Cursor Community Forum](https://forum.cursor.com/t/cursor-stops-mid-completion-and-hangs/62151)
> "Cursor frequently stops mid-completion, hanging indefinitely and never finishing"
> — Forces repeated retries, consumes completion quotas.

**attrition fix:** Provider-agnostic. Same judge hooks work for Cursor via MCP.

## 10. 97% Token Waste On Instructions

**Source:** [Medium/@DebaA](https://medium.com/@DebaA/your-ai-agent-is-wasting-97-of-its-tokens-reading-instructions-it-never-uses-f46582e57a9b)
> "Your AI Agent Might Be Wasting 97% of Its Tokens Reading Instructions It Never Uses"
> — Agent loads 30 tool definitions (21K tokens) before reading the actual request.

**attrition fix:** Distillation strips tool definitions from replay. Only essential context retained.

---

## Summary For Marketing

| Pain | How common | attrition fix |
|------|-----------|---------------|
| Agent says "done" too early | 112K stars on claude-code repo, issues #1632 #24129 #599 | Stop hook blocks incomplete work |
| Context loss in long sessions | MIT Technology Review documented | Session-start hook resumes |
| 70% token waste | Tracked across 42 real runs | 45% distillation compression |
| $500-2K/month API costs | Developer survey data | 60-70% cheaper replay |
| Manual CLAUDE.md workarounds | 5+ articles on the topic | Automated enforcement, not manual config |
| Cursor stops mid-completion | Forum thread with 100+ views | Provider-agnostic MCP hooks |
