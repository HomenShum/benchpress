import { Layout } from "../components/Layout";

/* ── Styles ────────────────────────────────────────────────── */

const glass: React.CSSProperties = {
  borderRadius: "0.625rem",
  border: "1px solid rgba(255,255,255,0.06)",
  background: "#141415",
};
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const sec: React.CSSProperties = { fontSize: "0.8125rem", color: "#9a9590", lineHeight: 1.6 };
const label: React.CSSProperties = { fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#9a9590", marginBottom: "0.5rem" };
const accentLabel: React.CSSProperties = { ...label, color: "#d97757", fontWeight: 600 };

/* ── Component ─────────────────────────────────────────────── */

export function Proof() {
  return (
    <Layout>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem 2rem" }}>

        {/* ════════════════════════════════════════════════════════
            FLAGSHIP CASE — the full intervention loop, above the fold
            ════════════════════════════════════════════════════════ */}

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "2.25rem", fontWeight: 700, letterSpacing: "-0.025em", color: "#e8e6e3", marginBottom: "0.375rem" }}>
            One workflow. Full loop.
          </h1>
          <p style={{ ...sec, maxWidth: 600, margin: "0 auto", fontSize: "1rem" }}>
            The agent stopped. Attrition caught what was missing. The run resumed. The replay got cheaper.
          </p>
        </div>

        <div style={{ ...glass, padding: "1.5rem", marginBottom: "3.5rem" }}>
          {/* Task header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <span style={{ ...mono, fontSize: "0.6875rem", padding: "0.125rem 0.5rem", borderRadius: "0.25rem", background: "rgba(217,119,87,0.12)", color: "#d97757" }}>
              flagship case
            </span>
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "#e8e6e3" }}>Refactor API client — sync to async/await</span>
          </div>

          {/* 4-phase intervention loop */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.625rem", marginBottom: "1.25rem" }}>

            {/* Phase A: Baseline */}
            <div style={{ ...glass, padding: "0.875rem", background: "rgba(255,255,255,0.02)" }}>
              <div style={label}>A. Agent reported</div>
              <div style={{ fontSize: "0.8125rem", color: "#9a9590", lineHeight: 1.5 }}>
                <div style={{ marginBottom: "0.25rem" }}><span style={{ color: "#22c55e" }}>✓</span> Grep sync patterns</div>
                <div style={{ marginBottom: "0.25rem" }}><span style={{ color: "#22c55e" }}>✓</span> Edited 4 files</div>
                <div style={{ marginBottom: "0.25rem" }}><span style={{ color: "#22c55e" }}>✓</span> Tests pass</div>
                <div style={{ marginBottom: "0.25rem" }}><span style={{ color: "#22c55e" }}>✓</span> Build clean</div>
                <div style={{ ...mono, fontSize: "0.75rem", color: "#22c55e", marginTop: "0.5rem" }}>"Done!"</div>
              </div>
            </div>

            {/* Phase B: Attrition catch */}
            <div style={{ ...glass, padding: "0.875rem", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.02)" }}>
              <div style={{ ...label, color: "#ef4444" }}>B. Attrition caught</div>
              <div style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}>
                <div style={{ color: "#ef4444", marginBottom: "0.25rem" }}><span style={{ ...mono, fontSize: "0.6875rem" }}>MISSING</span> Breaking-change search</div>
                <div style={{ color: "#ef4444", marginBottom: "0.25rem" }}><span style={{ ...mono, fontSize: "0.6875rem" }}>MISSING</span> Update generated types</div>
                <div style={{ color: "#ef4444", marginBottom: "0.25rem" }}><span style={{ ...mono, fontSize: "0.6875rem" }}>MISSING</span> Integration tests</div>
                <div style={{ ...mono, fontSize: "0.75rem", color: "#ef4444", marginTop: "0.5rem" }}>Verdict: BLOCKED</div>
              </div>
            </div>

            {/* Phase C: Intervention */}
            <div style={{ ...glass, padding: "0.875rem", border: "1px solid rgba(217,119,87,0.2)", background: "rgba(217,119,87,0.02)" }}>
              <div style={accentLabel}>C. After intervention</div>
              <div style={{ fontSize: "0.8125rem", color: "#e8e6e3", lineHeight: 1.5 }}>
                <div style={{ marginBottom: "0.25rem" }}><span style={{ color: "#d97757" }}>+</span> Searched npm audit</div>
                <div style={{ marginBottom: "0.25rem" }}><span style={{ color: "#d97757" }}>+</span> Updated api.d.ts</div>
                <div style={{ marginBottom: "0.25rem" }}><span style={{ color: "#d97757" }}>+</span> Ran integration tests</div>
                <div style={{ ...mono, fontSize: "0.75rem", color: "#22c55e", marginTop: "0.5rem" }}>Verdict: ACCEPTED</div>
              </div>
            </div>

            {/* Phase D: Outcome */}
            <div style={{ ...glass, padding: "0.875rem", border: "1px solid rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.02)" }}>
              <div style={{ ...label, color: "#22c55e" }}>D. Measurable outcome</div>
              <div style={{ fontSize: "0.8125rem", color: "#e8e6e3", lineHeight: 1.5 }}>
                <div style={{ marginBottom: "0.25rem" }}>8/8 steps verified</div>
                <div style={{ marginBottom: "0.25rem" }}>0 user corrections needed</div>
                <div style={{ marginBottom: "0.25rem" }}>Replay: 56% fewer tokens</div>
                <div style={{ ...mono, fontSize: "0.75rem", color: "#22c55e", marginTop: "0.5rem" }}>$0.82 → $0.18 next run</div>
              </div>
            </div>
          </div>

          {/* Source + trace links */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ ...mono, fontSize: "0.625rem", padding: "0.125rem 0.5rem", borderRadius: "0.25rem", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)", color: "#eab308" }}>
              REPRODUCIBLE BENCHMARK TRACE
            </span>
            <a href="https://github.com/HomenShum/attrition/blob/main/benchmarks/pain_sessions/cost_overrun.jsonl" target="_blank" rel="noopener noreferrer" style={{ ...mono, fontSize: "0.625rem", color: "#d97757", textDecoration: "none" }}>
              View session JSONL →
            </a>
            <a href="https://github.com/HomenShum/attrition/blob/main/benchmarks/results/pain_benchmarks.json" target="_blank" rel="noopener noreferrer" style={{ ...mono, fontSize: "0.625rem", color: "#9a9590", textDecoration: "none" }}>
              View verdict JSON →
            </a>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            PROOF TAXONOMY — what kind of evidence exists
            ════════════════════════════════════════════════════════ */}

        <div style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#9a9590", marginBottom: "1rem", textAlign: "center" }}>
            Proof types
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.625rem" }}>
            {[
              { badge: "COMMUNITY PAIN", color: "#9a9590", bg: "rgba(255,255,255,0.04)", desc: "Real quotes from GitHub issues, Medium, Reddit, HN" },
              { badge: "BENCHMARK FIXTURE", color: "#eab308", bg: "rgba(234,179,8,0.06)", desc: "Reproducible JSONL sessions built to demonstrate specific pains" },
              { badge: "JUDGE VERDICT", color: "#d97757", bg: "rgba(217,119,87,0.06)", desc: "Computed by the attrition judge engine, not self-reported" },
              { badge: "INTERVENTION LOOP", color: "#22c55e", bg: "rgba(34,197,94,0.06)", desc: "Full A→B→C→D cycle: miss → catch → fix → measurable outcome" },
            ].map((t) => (
              <div key={t.badge} style={{ ...glass, padding: "0.875rem", background: t.bg, textAlign: "center" }}>
                <div style={{ ...mono, fontSize: "0.625rem", fontWeight: 600, color: t.color, marginBottom: "0.375rem" }}>{t.badge}</div>
                <div style={{ fontSize: "0.75rem", color: "#9a9590", lineHeight: 1.4 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            5 PAIN ROWS — now with 4 columns each
            ════════════════════════════════════════════════════════ */}

        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e8e6e3", marginBottom: "0.375rem" }}>
          Five pains. Five catches. Five outcomes.
        </h2>
        <p style={{ ...sec, marginBottom: "2rem" }}>
          Each row: community pain source → what the baseline agent did → what attrition caught → what happened after.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {([
            {
              pain: "Agent says \"done\" with unfinished TODOs",
              theme: "false_completion",
              source: { quote: "Claude Code will often stop after a task, forgetting it has unfinished TODOs.", label: "claude-code #1632", url: "https://github.com/anthropics/claude-code/issues/1632" },
              baseline: "Agent completed 3/10 TODOs. Declared project 'fully reconstructed.' 7 items silently dropped.",
              caught: "on-stop fired. Judge: 2/8 steps = 25%. Verdict: FAILED. Listed 6 missing steps. Blocked stop.",
              after: "Agent resumed without user correction. Completed remaining items. Final: 8/8 ACCEPTED.",
              outcome: "1 correction cycle eliminated. Zero re-exploration tokens wasted.",
              verdictBadge: "FAILED → ACCEPTED", verdictColor: "#ef4444",
              trace: "false_completion",
            },
            {
              pain: "Agent skips explicit instructions silently",
              theme: "instruction_drift",
              source: { quote: "Claude selectively completed only the easy parts and skipped the rest without asking.", label: "claude-code #24129", url: "https://github.com/anthropics/claude-code/issues/24129" },
              baseline: "User gave 5 requirements (PDF, xlsx, csv, inner/outer data). Agent processed xlsx only. No notification.",
              caught: "on-prompt injected 5 required data sources as checklist. on-tool-use: xlsx ✓, PDF ✗, csv ✗ after 9 calls.",
              after: "Nudge fired at tool call 9: 'Missing: PDF parsing, CSV processing.' Agent pivoted immediately.",
              outcome: "Gap caught at minute 3, not hour 3. 2 re-exploration cycles avoided.",
              verdictBadge: "FAILED → PARTIAL", verdictColor: "#ef4444",
              trace: "instruction_drift",
            },
            {
              pain: "70% of tokens are waste in agent runs",
              theme: "cost_overrun",
              source: { quote: "A developer tracking consumption across 42 runs found that 70% of tokens were waste.", label: "Morph LLM", url: "https://www.morphllm.com/ai-coding-costs" },
              baseline: "Agent read 15 files (12 irrelevant), searched same query 3x, explored 2 dead-end approaches. 52K tokens.",
              caught: "Distiller: eliminated dead-ends, deduplicated searches, extracted copy-paste blocks. 28 → 12 essential steps.",
              after: "Distilled replay: 23K tokens on Sonnet. Judge verified 6/8 steps on replay (2 missing: preview, qa).",
              outcome: "$0.82 → $0.18 per run. 56% token reduction. Replay accepted as PARTIAL.",
              verdictBadge: "PARTIAL (6/8)", verdictColor: "#eab308",
              trace: "cost_overrun",
            },
            {
              pain: "CLAUDE.md rules ignored 40% of the time",
              theme: "rules_file_overload",
              source: { quote: "Users write long CLAUDE.md files to stop repeated mistakes, but still complain about instruction-following.", label: "Reddit + HN 2026", url: "https://www.reddit.com/r/ClaudeAI/" },
              baseline: "CLAUDE.md says 'always run tests.' Agent added feature, ran build, skipped tests and preview. Said 'Done!'",
              caught: "on-stop: no Bash call containing 'test' or 'vitest'. 5/8 steps. Verdict: ESCALATE. 1 user correction detected.",
              after: "User said 'you didn't run the tests.' Judge recorded correction → learner tightens 'test_run' enforcement.",
              outcome: "Next session: test step promoted to hard gate. Agent cannot stop without test evidence.",
              verdictBadge: "ESCALATE (5/8)", verdictColor: "#f97316",
              trace: "rules_overload",
            },
            {
              pain: "Context lost between sessions",
              theme: "memory_loss",
              source: { quote: "Users keep restating context or mining old logs because the system does not retrieve prior knowledge.", label: "HN threads 2026", url: "https://news.ycombinator.com/" },
              baseline: "Day 2: user re-explains 7-step deploy workflow from scratch. 3K tokens + 15 min re-exploration.",
              caught: "on-session-start: retrieved prior workflow (47 events). Injected 7 required steps into context.",
              after: "Agent started with full workflow knowledge. Executed deploy steps in order. 5/8 steps verified.",
              outcome: "15 min + 3K tokens saved per resumed session. No re-explanation needed.",
              verdictBadge: "ESCALATE (5/8)", verdictColor: "#f97316",
              trace: "memory_loss",
            },
          ] as const).map((row, i) => (
            <div key={i} style={{ ...glass, padding: "1.25rem" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <span style={{ ...mono, fontSize: "0.625rem", padding: "0.1rem 0.375rem", borderRadius: "0.2rem", background: "rgba(217,119,87,0.1)", color: "#d97757" }}>{row.theme}</span>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "#e8e6e3" }}>{row.pain}</span>
              </div>

              {/* Source quote */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "1rem", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", background: "rgba(255,255,255,0.02)" }}>
                <span style={{ color: "#d97757", flexShrink: 0 }}>&ldquo;</span>
                <div>
                  <span style={{ fontSize: "0.8125rem", color: "#e8e6e3" }}>{row.source.quote}</span>{" "}
                  <a href={row.source.url} target="_blank" rel="noopener noreferrer" style={{ ...mono, fontSize: "0.625rem", color: "#d97757", textDecoration: "none" }}>{row.source.label} →</a>
                </div>
              </div>

              {/* 4 columns: baseline → caught → after → outcome */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ padding: "0.625rem", borderRadius: "0.375rem", background: "rgba(255,255,255,0.02)", opacity: 0.7 }}>
                  <div style={{ ...label, fontSize: "0.5625rem" }}>Baseline agent</div>
                  <div style={{ fontSize: "0.75rem", color: "#9a9590", lineHeight: 1.4 }}>{row.baseline}</div>
                </div>
                <div style={{ padding: "0.625rem", borderRadius: "0.375rem", background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.1)" }}>
                  <div style={{ ...label, fontSize: "0.5625rem", color: "#ef4444" }}>Attrition caught</div>
                  <div style={{ fontSize: "0.75rem", color: "#e8e6e3", lineHeight: 1.4 }}>{row.caught}</div>
                </div>
                <div style={{ padding: "0.625rem", borderRadius: "0.375rem", background: "rgba(217,119,87,0.03)", border: "1px solid rgba(217,119,87,0.1)" }}>
                  <div style={{ ...label, fontSize: "0.5625rem", color: "#d97757" }}>After intervention</div>
                  <div style={{ fontSize: "0.75rem", color: "#e8e6e3", lineHeight: 1.4 }}>{row.after}</div>
                </div>
                <div style={{ padding: "0.625rem", borderRadius: "0.375rem", background: "rgba(34,197,94,0.03)", border: "1px solid rgba(34,197,94,0.1)" }}>
                  <div style={{ ...label, fontSize: "0.5625rem", color: "#22c55e" }}>Outcome</div>
                  <div style={{ fontSize: "0.75rem", color: "#22c55e", lineHeight: 1.4 }}>{row.outcome}</div>
                </div>
              </div>

              {/* Badge + trace */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
                <span style={{ ...mono, fontSize: "0.5625rem", padding: "0.1rem 0.375rem", borderRadius: "0.2rem", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.15)", color: "#eab308" }}>
                  BENCHMARK FIXTURE
                </span>
                <span style={{ ...mono, fontSize: "0.625rem", fontWeight: 600, color: row.verdictColor }}>{row.verdictBadge}</span>
                <a href={`https://github.com/HomenShum/attrition/blob/main/benchmarks/pain_sessions/${row.trace}.jsonl`} target="_blank" rel="noopener noreferrer" style={{ ...mono, fontSize: "0.5625rem", color: "#9a9590", textDecoration: "none" }}>
                  {row.trace}.jsonl →
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: "3rem" }}>
          <p style={{ ...sec, marginBottom: "1rem" }}>
            Every pain is a real 2026 developer complaint. Every fixture is a reproducible JSONL trace. Every verdict is computed, not claimed.
          </p>
          <div style={{ ...glass, ...mono, padding: "1rem 1.5rem", fontSize: "0.875rem", maxWidth: 460, margin: "0 auto 0.5rem", border: "1px solid rgba(217,119,87,0.25)", background: "rgba(217,119,87,0.03)", textAlign: "center" }}>
            <span style={{ color: "#d97757" }}>$</span> <span style={{ color: "#e8e6e3" }}>curl -sL attrition.sh/install | bash</span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#9a9590" }}>Free forever. Runs locally.</p>
        </div>

      </div>
    </Layout>
  );
}
