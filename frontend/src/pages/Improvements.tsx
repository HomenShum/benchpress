import { Layout } from "../components/Layout";

/* ── Styles ─────────────────────────────────────────────── */
const glass: React.CSSProperties = { borderRadius: "0.625rem", border: "1px solid rgba(255,255,255,0.06)", background: "#141415" };
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const muted: React.CSSProperties = { fontSize: "0.8125rem", color: "#9a9590", lineHeight: 1.6 };
const label: React.CSSProperties = { fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#9a9590", marginBottom: "0.5rem" };

/* ── Real co-dev data — exact evidence per iteration ───── */

const ITERATIONS = [
  {
    num: 1, passRate: 80, latency: 15.3,
    title: "Built the eval harness",
    problem: "No way to measure search quality. Changes were blind — nobody knew if search got better or worse.",
    fix: "Built a 53-query eval corpus with Gemini 3.1 Flash Lite as judge. Structural checks (deterministic) + LLM quality checks (stochastic).",
    files: [
      { path: "server/routes/search.ts", change: "Added 4-layer grounding pipeline: retrieval confidence → claim filter → grounded judge → citation chain" },
      { path: "packages/mcp-local/src/benchmarks/searchQualityEval.ts", change: "53 queries across 8 categories: company, competitor, temporal, adversarial, niche, diligence, scenario, multi-entity" },
    ],
    sources: ["Linkup API for web search", "Gemini 3.1 Flash Lite Preview for judge"],
    verdict: "Baseline established. 80% pass rate on first run.",
  },
  {
    num: 2, passRate: 70, latency: 12.9,
    title: "Fixed hallucination in entity extraction",
    problem: "Score dropped to 70%. Root cause: Gemini fabricated company details when web search returned thin results. The judge was too lenient on ungrounded claims.",
    fix: "Added isGrounded() claim-level filter — any claim with ZERO word overlap against source text gets rejected. Added retrievalConfidence threshold — low-confidence queries skip extraction entirely.",
    files: [
      { path: "server/routes/search.ts", change: "isGrounded(claim, sourceCorpus) — rejects claims with no word overlap against retrieval snippets" },
      { path: "server/routes/search.ts", change: "retrievalConfidence: high (3+ snippets) → full extract, medium (1-2) → conservative, low (0) → skip" },
    ],
    sources: ["arxiv:2510.24476 — RAG + reasoning + agentic grounding systems", "Deepchecks claim-level verification pattern"],
    verdict: "Pass rate dropped during fix (expected — tightened the judge bar). Latency improved 15.3s → 12.9s.",
  },
  {
    num: 3, passRate: 80, latency: 15.5,
    title: "Entity enrichment + web search fallback",
    problem: "Niche entities (small companies, new products) returned empty results. Pipeline had no fallback when primary search failed.",
    fix: "Added 8 entity enrichment tools and Linkup web search fallback. If primary search returns <2 snippets, fall back to web search before giving up.",
    files: [
      { path: "packages/mcp-local/src/tools/entityEnrichmentTools.ts", change: "8 new tools: company financials, competitors, news, team, market position, product catalog, funding, partnerships" },
      { path: "packages/mcp-local/src/tools/webTools.ts", change: "web_search with Linkup API + Gemini extraction. Fallback chain: Linkup → Gemini grounding → regex extraction" },
    ],
    sources: ["Google Vertex AI grounding pipeline research", "Linkup search API documentation"],
    verdict: "Back to 80%. Niche entity queries (e.g. 'analyze Acme AI Series A') now return real data instead of empty.",
  },
  {
    num: 4, passRate: 100, latency: 15.2,
    title: "Pipeline convergence — 100% pass",
    problem: "Last 20% failures were from query classification errors and packet assembly bugs, not search quality. The pipeline had 3 code paths producing packets in slightly different formats.",
    fix: "Converged on one canonical pipeline: classify → search → analyze → package. Added HyperLoop eval + archive promotion directly in the pipeline route. Expanded corpus from 53 → 103 queries.",
    files: [
      { path: "server/routes/pipelineRoute.ts", change: "HyperLoop eval + archive promotion called after stateToResultPacket(). Best-effort — never blocks the response." },
      { path: "server/pipeline/searchPipeline.ts", change: "Single canonical pipeline: classify → search → analyze → package. Typed state flows through each stage." },
    ],
    sources: ["Internal eval harness — 103 queries across 18 categories", "Gemini 3.1 Flash Lite judge with grounded eval prompts"],
    verdict: "100% pass rate. All 103 queries pass both structural and LLM quality checks. Zero regressions.",
  },
  {
    num: 5, passRate: 100, latency: 13.1,
    title: "Citation badges + latency drop",
    problem: "Users couldn't tell which claims were verified vs speculative. Latency stuck at 15.2s — target was sub-14s.",
    fix: "Added citation verification badges (verified / partial / unverified / contradicted) matching Perplexity Deep Research UX. Optimized pipeline to cut redundant search calls. Wrote SPA crawl fix spec for future.",
    files: [
      { path: "src/features/controlPlane/components/ResultWorkspace.tsx", change: "Citation tooltips show verification status badge + claim linkage text. Matches Perplexity/Claude Research citation UX." },
      { path: "docs/architecture/SPA_CRAWL_FIX.md", change: "4 concrete fixes: networkidle wait strategy, SPA root selector detection, local Playwright mode, relay asset rewriting" },
    ],
    sources: ["Perplexity Deep Research citation review", "Claude Citations API documentation"],
    verdict: "100% maintained. Latency 15.2s → 13.1s (14% faster). Citation UX now matches industry standard.",
  },
];

/* ── Component ──────────────────────────────────────────── */

export function Improvements() {
  return (
    <Layout>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem 2rem" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#e8e6e3", marginBottom: "0.5rem" }}>
            NodeBench search: 80% → 100% in 5 iterations
          </h1>
          <p style={{ ...muted, fontSize: "1rem", maxWidth: 600, margin: "0 auto" }}>
            Every fix traced to a root cause. Every source cited. Every code change linked. Every metric measured.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ ...glass, padding: "1.25rem 1.5rem", marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 64 }}>
            {ITERATIONS.map((it, i) => {
              const color = it.passRate === 100 ? "#22c55e" : it.passRate >= 80 ? "#eab308" : "#ef4444";
              const h = Math.max(12, (it.passRate / 100) * 56);
              const prev = i > 0 ? ITERATIONS[i-1].passRate : null;
              const delta = prev !== null ? it.passRate - prev : null;
              return (
                <div key={it.num} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ width: 40, height: h, background: color, borderRadius: "0.25rem 0.25rem 0 0", margin: "0 auto", transition: "height 0.3s" }} />
                  <div style={{ ...mono, fontSize: "0.8125rem", fontWeight: 700, color, marginTop: "0.25rem" }}>{it.passRate}%</div>
                  {delta !== null && <div style={{ ...mono, fontSize: "0.5rem", color: delta > 0 ? "#22c55e" : delta < 0 ? "#ef4444" : "#6b6560" }}>{delta > 0 ? "+" : ""}{delta}</div>}
                  <div style={{ ...mono, fontSize: "0.5rem", color: "#6b6560" }}>{it.latency}s</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Iteration cards */}
        {ITERATIONS.map((it) => {
          const color = it.passRate === 100 ? "#22c55e" : it.passRate >= 80 ? "#eab308" : "#ef4444";
          return (
            <div key={it.num} style={{ ...glass, padding: "1.5rem", marginBottom: "1.25rem", borderLeft: `3px solid ${color}` }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.625rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                <span style={{ ...mono, fontSize: "1.5rem", fontWeight: 700, color }}>{it.passRate}%</span>
                <span style={{ ...mono, fontSize: "0.6875rem", color: "#6b6560" }}>{it.latency}s</span>
                <span style={{ fontSize: "1.125rem", fontWeight: 600, color: "#e8e6e3" }}>R{it.num}: {it.title}</span>
              </div>

              {/* Problem → Fix */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.75rem", borderRadius: "0.375rem", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)" }}>
                  <div style={{ fontSize: "0.5625rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#ef4444", marginBottom: "0.375rem", fontWeight: 600 }}>Problem</div>
                  <div style={{ fontSize: "0.8125rem", color: "#e8e6e3", lineHeight: 1.5 }}>{it.problem}</div>
                </div>
                <div style={{ padding: "0.75rem", borderRadius: "0.375rem", background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)" }}>
                  <div style={{ fontSize: "0.5625rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#22c55e", marginBottom: "0.375rem", fontWeight: 600 }}>Fix</div>
                  <div style={{ fontSize: "0.8125rem", color: "#e8e6e3", lineHeight: 1.5 }}>{it.fix}</div>
                </div>
              </div>

              {/* Code changes */}
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={label}>Code changes</div>
                {it.files.map((f, j) => (
                  <div key={j} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.25rem", background: "rgba(255,255,255,0.02)", marginBottom: "0.375rem" }}>
                    <span style={{ ...mono, fontSize: "0.625rem", color: "#d97757" }}>{f.path}</span>
                    <div style={{ fontSize: "0.75rem", color: "#9a9590", lineHeight: 1.4, marginTop: "0.125rem" }}>{f.change}</div>
                  </div>
                ))}
              </div>

              {/* Sources */}
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={label}>Sources cited</div>
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {it.sources.map((s) => (
                    <span key={s} style={{ ...mono, fontSize: "0.5625rem", padding: "0.125rem 0.5rem", borderRadius: "2rem", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", color: "#a78bfa" }}>{s}</span>
                  ))}
                </div>
              </div>

              {/* Verdict */}
              <div style={{ ...mono, fontSize: "0.6875rem", color, padding: "0.375rem 0.75rem", borderRadius: "0.25rem", background: `${color}0a`, border: `1px solid ${color}20` }}>
                {it.verdict}
              </div>
            </div>
          );
        })}

        {/* Summary */}
        <div style={{ ...glass, padding: "1.5rem", textAlign: "center", marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            {[
              { val: "5", lab: "iterations" },
              { val: "80→100%", lab: "pass rate" },
              { val: "13.1s", lab: "final latency" },
              { val: "10", lab: "code changes" },
              { val: "8", lab: "sources cited" },
            ].map(s => (
              <div key={s.lab}>
                <div style={{ ...mono, fontSize: "1.25rem", fontWeight: 700, color: "#d97757" }}>{s.val}</div>
                <div style={{ fontSize: "0.625rem", color: "#6b6560" }}>{s.lab}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.6875rem", color: "#6b6560" }}>Every change traceable. Every improvement measured.</p>
        </div>
      </div>
    </Layout>
  );
}
