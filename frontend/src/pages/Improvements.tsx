import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";

/* ── Styles ─────────────────────────────────────────────── */
const glass: React.CSSProperties = { borderRadius: "0.625rem", border: "1px solid rgba(255,255,255,0.06)", background: "#141415" };
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const muted: React.CSSProperties = { fontSize: "0.8125rem", color: "#9a9590", lineHeight: 1.6 };
const label: React.CSSProperties = { fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#9a9590", marginBottom: "0.5rem" };

/* ── Types ──────────────────────────────────────────────── */

interface RetentionPacket {
  type: string;
  subject: string;
  summary: string;
  timestamp: string;
  id?: string;
}

interface ParsedRun {
  query: string;
  confidence: number;
  sources: number;
  durationMs: number;
  timestamp: string;
}

/* ── Helpers ────────────────────────────────────────────── */

function parseSummary(summary: string): { confidence: number; sources: number; durationMs: number } {
  // Matches: "Confidence: 95, Sources: 6, Duration: 24195ms"
  // Also:    "Score: 95, Sources: 6, Duration: 24195ms"
  const confMatch = summary.match(/(?:Confidence|Score):\s*(\d+)/i);
  const srcMatch = summary.match(/Sources:\s*(\d+)/i);
  const durMatch = summary.match(/Duration:\s*(\d+)/i);

  return {
    confidence: confMatch ? parseInt(confMatch[1], 10) : 0,
    sources: srcMatch ? parseInt(srcMatch[1], 10) : 0,
    durationMs: durMatch ? parseInt(durMatch[1], 10) : 0,
  };
}

function stripPrefix(subject: string): string {
  return subject.replace(/^Pipeline:\s*/i, "").trim();
}

function confidenceColor(c: number): string {
  if (c >= 90) return "#22c55e";
  if (c >= 70) return "#eab308";
  return "#ef4444";
}

function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(1) + "s";
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

/* ── Component ──────────────────────────────────────────── */

export function Improvements() {
  const [runs, setRuns] = useState<ParsedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPackets() {
      try {
        const res = await fetch("/api/retention/packets");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const packets: RetentionPacket[] = await res.json();

        if (cancelled) return;

        const pipelineRuns = packets
          .filter((p) => p.type === "delta.pipeline_run")
          .map((p): ParsedRun => {
            const parsed = parseSummary(p.summary);
            return {
              query: stripPrefix(p.subject),
              confidence: parsed.confidence,
              sources: parsed.sources,
              durationMs: parsed.durationMs,
              timestamp: p.timestamp,
            };
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setRuns(pipelineRuns);
        setIsLive(pipelineRuns.length > 0);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Could not connect to the attrition API.");
        setLoading(false);
      }
    }

    fetchPackets();
    return () => { cancelled = true; };
  }, []);

  /* ── Derived stats ── */
  const totalRuns = runs.length;
  const avgConfidence = totalRuns > 0
    ? Math.round(runs.reduce((s, r) => s + r.confidence, 0) / totalRuns)
    : 0;
  const avgDuration = totalRuns > 0
    ? runs.reduce((s, r) => s + r.durationMs, 0) / totalRuns
    : 0;
  const totalSources = runs.reduce((s, r) => s + r.sources, 0);

  return (
    <Layout>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem 2rem" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#e8e6e3", marginBottom: "0.5rem" }}>
            Captured Runs
          </h1>
          <p style={{ ...muted, fontSize: "1rem", maxWidth: 600, margin: "0 auto 1rem" }}>
            Real NodeBench pipeline searches captured by attrition
          </p>

          {/* Source badge */}
          {!loading && (
            <span style={{
              ...mono,
              fontSize: "0.625rem",
              fontWeight: 700,
              padding: "0.25rem 0.75rem",
              borderRadius: "2rem",
              background: isLive ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
              border: `1px solid ${isLive ? "rgba(34,197,94,0.25)" : "rgba(234,179,8,0.25)"}`,
              color: isLive ? "#22c55e" : "#eab308",
              letterSpacing: "0.08em",
            }}>
              {isLive ? "LIVE DATA" : "NO DATA"}
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ ...glass, padding: "3rem", textAlign: "center" }}>
            <div style={{ ...mono, fontSize: "0.875rem", color: "#9a9590" }}>
              Fetching captured runs...
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{
            ...glass,
            padding: "2rem",
            textAlign: "center",
            borderLeft: "3px solid #ef4444",
          }}>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#e8e6e3", marginBottom: "0.75rem" }}>
              {error}
            </div>
            <div style={muted}>
              Make sure the attrition backend is running:
            </div>
            <div style={{
              ...mono,
              fontSize: "0.8125rem",
              color: "#d97757",
              background: "rgba(255,255,255,0.02)",
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              marginTop: "0.75rem",
              display: "inline-block",
            }}>
              npm run dev
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && runs.length === 0 && (
          <div style={{ ...glass, padding: "3rem", textAlign: "center" }}>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#e8e6e3", marginBottom: "0.5rem" }}>
              No captured runs yet.
            </div>
            <p style={muted}>
              Run a NodeBench search to see data here.
            </p>
          </div>
        )}

        {/* Data present */}
        {!loading && !error && runs.length > 0 && (
          <>
            {/* Summary stats */}
            <div style={{ ...glass, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap" }}>
                {[
                  { val: String(totalRuns), lab: "runs captured" },
                  { val: `${avgConfidence}%`, lab: "avg confidence", color: confidenceColor(avgConfidence) },
                  { val: formatDuration(avgDuration), lab: "avg duration" },
                  { val: String(totalSources), lab: "total sources" },
                ].map((s) => (
                  <div key={s.lab} style={{ textAlign: "center" }}>
                    <div style={{
                      ...mono,
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: s.color ?? "#d97757",
                    }}>
                      {s.val}
                    </div>
                    <div style={{ fontSize: "0.625rem", color: "#6b6560", marginTop: "0.125rem" }}>
                      {s.lab}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence bar chart */}
            <div style={{ ...glass, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
              <div style={label}>Confidence by run</div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 64 }}>
                {runs.map((run, i) => {
                  const color = confidenceColor(run.confidence);
                  const h = Math.max(12, (run.confidence / 100) * 56);
                  return (
                    <div key={`${run.timestamp}-${i}`} style={{ textAlign: "center", flex: 1 }}>
                      <div style={{
                        width: 40,
                        height: h,
                        background: color,
                        borderRadius: "0.25rem 0.25rem 0 0",
                        margin: "0 auto",
                        transition: "height 0.3s",
                      }} />
                      <div style={{ ...mono, fontSize: "0.6875rem", fontWeight: 700, color, marginTop: "0.25rem" }}>
                        {run.confidence}%
                      </div>
                      <div style={{ ...mono, fontSize: "0.5rem", color: "#6b6560" }}>
                        {formatDuration(run.durationMs)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Run cards */}
            {runs.map((run, i) => {
              const color = confidenceColor(run.confidence);
              return (
                <div key={`${run.timestamp}-${i}`} style={{
                  ...glass,
                  padding: "1.25rem 1.5rem",
                  marginBottom: "1rem",
                  borderLeft: `3px solid ${color}`,
                }}>
                  {/* Top row: confidence + query */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    <span style={{ ...mono, fontSize: "1.375rem", fontWeight: 700, color }}>
                      {run.confidence}%
                    </span>
                    <span style={{ fontSize: "1rem", fontWeight: 600, color: "#e8e6e3", flex: 1 }}>
                      {run.query}
                    </span>
                    <span style={{ ...mono, fontSize: "0.6875rem", color: "#6b6560", flexShrink: 0 }}>
                      {formatTimestamp(run.timestamp)}
                    </span>
                  </div>

                  {/* Metrics row */}
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={label}>Sources</div>
                      <div style={{ ...mono, fontSize: "0.9375rem", fontWeight: 600, color: "#a78bfa" }}>
                        {run.sources}
                      </div>
                    </div>
                    <div>
                      <div style={label}>Duration</div>
                      <div style={{ ...mono, fontSize: "0.9375rem", fontWeight: 600, color: "#9a9590" }}>
                        {formatDuration(run.durationMs)}
                      </div>
                    </div>
                    <div>
                      <div style={label}>Confidence</div>
                      <div style={{
                        ...mono,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.125rem 0.5rem",
                        borderRadius: "2rem",
                        background: `${color}15`,
                        border: `1px solid ${color}30`,
                        color,
                        display: "inline-block",
                      }}>
                        {run.confidence >= 90 ? "HIGH" : run.confidence >= 70 ? "MEDIUM" : "LOW"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </Layout>
  );
}
