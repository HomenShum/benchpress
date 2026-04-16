import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import {
  getAdvisorStats,
  getAdvisorSessions,
  getAdvisorDecisions,
  type AdvisorStatsResponse,
  type AdvisorSession,
  type AdvisorDecision,
  type AdvisorModelBreakdown,
} from "../lib/api";

/* ── Styles ──────────────────────────────────────────────────────── */

const glass: React.CSSProperties = {
  padding: "1.25rem 1.5rem",
  borderRadius: "0.75rem",
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
};

const label: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  color: "var(--text-muted)",
  marginBottom: "0.25rem",
};

const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
};

const bigNumber: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  ...mono,
};

const statCard: React.CSSProperties = {
  ...glass,
  textAlign: "center" as const,
  minWidth: 140,
};

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function roleColor(role: string): string {
  if (role === "executor") return "#60a5fa";
  if (role === "advisor") return "#f59e0b";
  if (role === "pipeline") return "#22c55e";
  return "#9a9590";
}

function triggerBadge(trigger: string): { bg: string; text: string } {
  switch (trigger) {
    case "executor_failure":
      return { bg: "rgba(239,68,68,0.15)", text: "#ef4444" };
    case "complexity_threshold":
      return { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" };
    case "user_nudge":
      return { bg: "rgba(96,165,250,0.15)", text: "#60a5fa" };
    default:
      return { bg: "rgba(154,149,144,0.15)", text: "#9a9590" };
  }
}

/* ── Component ───────────────────────────────────────────────────── */

export function AdvisorDashboard() {
  const [stats, setStats] = useState<AdvisorStatsResponse | null>(null);
  const [sessions, setSessions] = useState<AdvisorSession[]>([]);
  const [decisions, setDecisions] = useState<AdvisorDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getAdvisorStats(),
      getAdvisorSessions(),
      getAdvisorDecisions(),
    ])
      .then(([s, sess, dec]) => {
        setStats(s);
        setSessions(sess.sessions);
        setDecisions(dec.decisions);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const s = stats?.stats;
  const hasData = s && (s.total_sessions > 0 || s.total_decisions > 0 || s.total_pipeline_runs > 0);

  return (
    <Layout>
      <div style={{ maxWidth: 1024, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
            Advisor Mode
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", lineHeight: 1.6, maxWidth: 640 }}>
            Sonnet executor + Opus advisor. Measure when escalation happens, what it costs,
            and whether it was worth it. All numbers from real API token counts.
          </p>
          <p style={{ ...mono, fontSize: "0.6875rem", marginTop: "0.5rem", color: "#d97757" }}>
            {stats?.message || "Loading..."}
          </p>
        </div>

        {loading && (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            Loading advisor data...
          </div>
        )}

        {error && (
          <div style={{ ...glass, border: "1px solid rgba(239,68,68,0.3)", marginBottom: "1.5rem" }}>
            <div style={label}>Error</div>
            <div style={{ color: "#ef4444", fontSize: "0.8125rem" }}>{error}</div>
          </div>
        )}

        {!loading && !hasData && !error && (
          <div style={{ ...glass, textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
              No advisor data yet
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
              Push <code style={mono}>advisor.session</code> or <code style={mono}>advisor.decision</code> packets
              to see real cost breakdowns. Pipeline runs with measured Gemini costs are also shown.
            </div>
            <div style={{ ...mono, fontSize: "0.75rem", color: "#9a9590", marginTop: "1rem" }}>
              POST /api/retention/push-packet
            </div>
          </div>
        )}

        {!loading && hasData && s && (
          <>
            {/* ── Stat Cards ─────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "2rem" }}>
              <div style={statCard}>
                <div style={label}>Combined Cost</div>
                <div style={{ ...bigNumber, color: "#e8e6e3" }}>{formatCost(s.combined_total_cost_usd)}</div>
                <div style={{ ...mono, fontSize: "0.625rem", color: "#22c55e", marginTop: "0.25rem" }}>MEASURED</div>
              </div>
              <div style={statCard}>
                <div style={label}>Advisor Share</div>
                <div style={{ ...bigNumber, color: "#f59e0b" }}>{s.advisor_cost_share_pct}%</div>
                <div style={{ ...mono, fontSize: "0.625rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>of total cost</div>
              </div>
              <div style={statCard}>
                <div style={label}>vs Opus-Only</div>
                <div style={{ ...bigNumber, color: "#22c55e" }}>
                  {s.savings_vs_opus_only_pct > 0 ? `-${s.savings_vs_opus_only_pct}%` : "N/A"}
                </div>
                <div style={{ ...mono, fontSize: "0.625rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>savings</div>
              </div>
              <div style={statCard}>
                <div style={label}>Escalation Rate</div>
                <div style={{ ...bigNumber, color: "#60a5fa" }}>{s.escalation_rate_pct}%</div>
                <div style={{ ...mono, fontSize: "0.625rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>of LLM calls</div>
              </div>
              <div style={statCard}>
                <div style={label}>Pipeline Runs</div>
                <div style={{ ...bigNumber, color: "#e8e6e3" }}>{s.total_pipeline_runs}</div>
                <div style={{ ...mono, fontSize: "0.625rem", color: "#22c55e", marginTop: "0.25rem" }}>with real costs</div>
              </div>
            </div>

            {/* ── Model Breakdown ────────────────────────────── */}
            {s.model_breakdown.length > 0 && (
              <div style={{ ...glass, marginBottom: "1.5rem" }}>
                <div style={{ ...label, marginBottom: "0.75rem" }}>Model Cost Breakdown</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", ...label }}>Model</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", ...label }}>Role</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", ...label }}>Calls</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", ...label }}>Tokens</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", ...label }}>Cost</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", ...label }}>Avg/Call</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.model_breakdown.map((m: AdvisorModelBreakdown, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "0.5rem 0.75rem", ...mono, fontSize: "0.75rem" }}>{m.model}</td>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          <span style={{
                            ...mono,
                            fontSize: "0.625rem",
                            padding: "0.125rem 0.5rem",
                            borderRadius: "0.25rem",
                            background: `${roleColor(m.role)}15`,
                            border: `1px solid ${roleColor(m.role)}30`,
                            color: roleColor(m.role),
                          }}>
                            {m.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", ...mono }}>{m.calls}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", ...mono }}>{formatTokens(m.total_tokens)}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", ...mono, color: "#22c55e" }}>
                          {formatCost(m.total_cost_usd)}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", ...mono, color: "var(--text-muted)" }}>
                          {formatTokens(m.avg_tokens_per_call)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Cost Split Visual ──────────────────────────── */}
            {(s.executor_total_cost_usd > 0 || s.advisor_total_cost_usd > 0) && (
              <div style={{ ...glass, marginBottom: "1.5rem" }}>
                <div style={{ ...label, marginBottom: "0.75rem" }}>Cost Split: Executor vs Advisor</div>
                <div style={{ display: "flex", height: 32, borderRadius: 6, overflow: "hidden", marginBottom: "0.75rem" }}>
                  {s.executor_total_cost_usd > 0 && (
                    <div
                      style={{
                        width: `${(s.executor_total_cost_usd / s.combined_total_cost_usd) * 100}%`,
                        background: "#60a5fa",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        ...mono,
                        fontSize: "0.625rem",
                        color: "#1e1e1e",
                        fontWeight: 700,
                      }}
                    >
                      Executor {formatCost(s.executor_total_cost_usd)}
                    </div>
                  )}
                  {s.advisor_total_cost_usd > 0 && (
                    <div
                      style={{
                        width: `${(s.advisor_total_cost_usd / s.combined_total_cost_usd) * 100}%`,
                        background: "#f59e0b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        ...mono,
                        fontSize: "0.625rem",
                        color: "#1e1e1e",
                        fontWeight: 700,
                      }}
                    >
                      Advisor {formatCost(s.advisor_total_cost_usd)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  <span>{formatTokens(s.executor_total_tokens)} executor tokens</span>
                  <span>{formatTokens(s.advisor_total_tokens)} advisor tokens</span>
                </div>
              </div>
            )}

            {/* ── Sessions ───────────────────────────────────── */}
            {sessions.length > 0 && (
              <div style={{ ...glass, marginBottom: "1.5rem" }}>
                <div style={{ ...label, marginBottom: "0.75rem" }}>Advisor Sessions ({sessions.length})</div>
                {sessions.map((sess, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "0.75rem",
                      borderBottom: i < sessions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{sess.subject}</span>
                      <span style={{ ...mono, fontSize: "0.6875rem", color: sess.task_completed ? "#22c55e" : "#ef4444" }}>
                        {sess.task_completed ? "COMPLETED" : "INCOMPLETE"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--text-muted)", ...mono }}>
                      <span style={{ color: "#60a5fa" }}>{formatTokens(sess.executor_tokens)} exec</span>
                      <span style={{ color: "#f59e0b" }}>{formatTokens(sess.advisor_tokens)} adv</span>
                      <span>{sess.escalation_count} escalations</span>
                      <span>{sess.user_corrections} corrections</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Decisions ──────────────────────────────────── */}
            {decisions.length > 0 && (
              <div style={{ ...glass, marginBottom: "1.5rem" }}>
                <div style={{ ...label, marginBottom: "0.75rem" }}>Escalation Decisions ({decisions.length})</div>
                {decisions.map((dec, i) => {
                  const badge = triggerBadge(dec.trigger);
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "0.75rem",
                        borderBottom: i < decisions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <span style={{
                          ...mono,
                          fontSize: "0.625rem",
                          padding: "0.125rem 0.5rem",
                          borderRadius: "0.25rem",
                          background: badge.bg,
                          border: `1px solid ${badge.text}30`,
                          color: badge.text,
                        }}>
                          {dec.trigger}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{dec.advice_type}</span>
                        <span style={{ ...mono, fontSize: "0.6875rem", color: dec.was_applied ? "#22c55e" : "#9a9590" }}>
                          {dec.was_applied ? "APPLIED" : "SKIPPED"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                        {dec.advice_summary}
                      </div>
                      <div style={{ ...mono, fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        {dec.advisor_model} - {formatTokens(dec.advisor_tokens)} tokens - {formatCost(dec.advisor_cost_usd)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── How It Works ───────────────────────────────── */}
            <div style={{ ...glass, marginBottom: "1.5rem" }}>
              <div style={{ ...label, marginBottom: "0.75rem" }}>How the Advisor Pattern Works</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: 1.8 }}>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#60a5fa" }}>1. Executor (Sonnet)</strong> handles routine tasks at $3/M input, $15/M output
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#f59e0b" }}>2. Advisor (Opus)</strong> called only for complex reasoning at $15/M input, $75/M output
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#22c55e" }}>3. Measured savings</strong> compared to running Opus for everything
                </div>
                <div>
                  <strong style={{ color: "#d97757" }}>4. Escalation tracking</strong> — know when, why, and whether it was worth the cost
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
