import { Layout } from "../components/Layout";
import { useState, useEffect } from "react";

/* ── Palette ──────────────────────────────────────────────────── */

const BG = "#0a0a0b";
const CARD = "#141415";
const BORDER = "rgba(255,255,255,0.06)";
const TEXT = "#e8e6e3";
const MUTED = "#6b6560";
const ACCENT = "#d97757";
const GREEN = "#22c55e";

/* ── Shared styles ────────────────────────────────────────────── */

const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
};

const codeBlock: React.CSSProperties = {
  ...mono,
  fontSize: "0.8125rem",
  color: "#9a9590",
  padding: "1rem 1.25rem",
  borderRadius: "0.5rem",
  background: BG,
  border: `1px solid ${BORDER}`,
  margin: 0,
  overflowX: "auto",
  lineHeight: 1.7,
  whiteSpace: "pre",
};

const sectionLabel: React.CSSProperties = {
  ...mono,
  fontSize: "0.6875rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.15em",
  color: MUTED,
  marginBottom: "1.25rem",
};

/* ── Types ────────────────────────────────────────────────────── */

interface Packet {
  entity?: string;
  query?: string;
  confidence?: number;
  sourceCount?: number;
  durationMs?: number;
  cost?: number;
}

/* ── Component ────────────────────────────────────────────────── */

export function Landing() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/retention/packets", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Packet[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setPackets(data.slice(0, 6));
          setLive(true);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  return (
    <Layout>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 1.5rem" }}>

        {/* ── HERO: what it is + quickstart ─────────────────────── */}
        <section style={{ padding: "5rem 0 3rem" }}>
          <h1 style={{
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: TEXT,
            marginBottom: "0.5rem",
          }}>
            attrition
          </h1>
          <p style={{
            fontSize: "1.125rem",
            color: MUTED,
            lineHeight: 1.6,
            marginBottom: "0.25rem",
            maxWidth: 480,
          }}>
            Measure and replay agent workflows.
          </p>
          <p style={{
            ...mono,
            fontSize: "0.875rem",
            color: MUTED,
            lineHeight: 1.6,
            marginBottom: "2.5rem",
          }}>
            One line to start capturing. One line to replay cheaper.
          </p>

          {/* Two code blocks side by side */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
          }}>
            <div>
              <div style={{ ...sectionLabel, marginBottom: "0.5rem" }}>Python</div>
              <pre style={codeBlock}>{`from attrition import track
track()
# Every LLM call is now captured + costed.
# Supports: OpenAI, Anthropic, LangChain, CrewAI`}</pre>
            </div>
            <div>
              <div style={{ ...sectionLabel, marginBottom: "0.5rem" }}>CLI</div>
              <pre style={codeBlock}>{`$ curl -sL attrition.sh/install | bash
$ attrition run claude "refactor the API client"
$ attrition replay <id> --model sonnet
# Cost: $1.84 -> $0.27`}</pre>
            </div>
          </div>
        </section>

        {/* ── WHAT YOU GET: 3 cards ────────────────────────────── */}
        <section style={{ marginBottom: "4rem" }}>
          <div style={sectionLabel}>What you get</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            {[
              {
                title: "CAPTURE",
                lines: [
                  "Wraps any agent session.",
                  "Tool calls, file edits,",
                  "searches -- all recorded.",
                ],
              },
              {
                title: "MEASURE",
                lines: [
                  "Real cost per run.",
                  "Latency, token count,",
                  "provider spend tracked.",
                ],
              },
              {
                title: "REPLAY",
                lines: [
                  "Replay successful runs",
                  "on cheaper models.",
                  "Judge verifies quality.",
                ],
              },
            ].map((card) => (
              <div key={card.title} style={{
                borderRadius: "0.5rem",
                border: `1px solid ${BORDER}`,
                background: CARD,
                padding: "1.25rem",
              }}>
                <div style={{
                  ...mono,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: ACCENT,
                  letterSpacing: "0.1em",
                  marginBottom: "0.75rem",
                }}>
                  {card.title}
                </div>
                {card.lines.map((line, i) => (
                  <div key={i} style={{ fontSize: "0.8125rem", color: MUTED, lineHeight: 1.6 }}>
                    {line}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ── INTEGRATION PATHS ────────────────────────────────── */}
        <section style={{ marginBottom: "4rem" }}>
          <div style={sectionLabel}>Integration paths</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {([
              ["Claude Code plugin", `$ curl -sL attrition.sh/install | bash\n# Installs 10 hooks: SessionStart, PreToolUse, PostToolUse, Stop, etc.\n# Every session is automatically captured.`],
              ["Python SDK", `from attrition import track\ntrack()  # auto-patches OpenAI, Anthropic, LangChain, CrewAI`],
              ["REST API (any backend)", `POST https://attrition.sh/api/retention/push-packet\n{\n  "type": "delta.pipeline_run",\n  "subject": "Company analysis: Anthropic",\n  "summary": "Confidence: 95, Sources: 6, Duration: 12s"\n}`],
              ["MCP tools (agent runtimes)", `{\n  "mcpServers": {\n    "attrition": {\n      "command": "npx",\n      "args": ["-y", "attrition@latest"]\n    }\n  }\n}`],
            ] as const).map(([title, code]) => (
              <div key={title}>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: TEXT, marginBottom: "0.5rem" }}>{title}</div>
                <pre style={codeBlock}>{code}</pre>
              </div>
            ))}
          </div>
        </section>

        {/* ── LIVE DATA ────────────────────────────────────────── */}
        <section style={{ marginBottom: "4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ ...sectionLabel, marginBottom: 0 }}>Live captured runs</div>
            {live && (
              <span style={{
                ...mono,
                fontSize: "0.625rem",
                fontWeight: 700,
                padding: "0.125rem 0.5rem",
                borderRadius: "0.25rem",
                background: "rgba(34,197,94,0.1)",
                color: GREEN,
                letterSpacing: "0.05em",
              }}>
                LIVE
              </span>
            )}
          </div>

          {packets.length > 0 ? (
            <div style={{
              borderRadius: "0.5rem",
              border: `1px solid ${BORDER}`,
              background: CARD,
              overflow: "hidden",
            }}>
              {packets.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.625rem 1rem",
                    borderBottom: i < packets.length - 1 ? `1px solid ${BORDER}` : "none",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{
                    ...mono,
                    fontSize: "0.8125rem",
                    color: TEXT,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    flex: 1,
                  }}>
                    {p.entity || p.query || "Unknown query"}
                  </div>
                  <div style={{
                    ...mono,
                    fontSize: "0.75rem",
                    color: MUTED,
                    display: "flex",
                    gap: "0.75rem",
                    flexShrink: 0,
                  }}>
                    {p.confidence != null && <span>{p.confidence}% conf</span>}
                    {p.sourceCount != null && <span>{p.sourceCount} src</span>}
                    {p.durationMs != null && <span>{(p.durationMs / 1000).toFixed(1)}s</span>}
                    {p.cost != null && <span style={{ color: GREEN }}>${p.cost.toFixed(3)}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              ...mono,
              borderRadius: "0.5rem",
              border: `1px solid ${BORDER}`,
              background: CARD,
              padding: "1.5rem",
              textAlign: "center",
              fontSize: "0.8125rem",
              color: MUTED,
            }}>
              Start the server to see live data
            </div>
          )}
          <div style={{ ...mono, fontSize: "0.75rem", color: MUTED, marginTop: "0.5rem" }}>
            Real data from NodeBench pipeline integration
          </div>
        </section>

        {/* ── API REFERENCE ────────────────────────────────────── */}
        <section style={{ marginBottom: "4rem" }}>
          <div style={sectionLabel}>API reference</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <div style={{
                ...mono,
                fontSize: "0.75rem",
                fontWeight: 700,
                color: TEXT,
                marginBottom: "0.75rem",
                letterSpacing: "0.05em",
              }}>
                ENDPOINTS
              </div>
              <pre style={{ ...codeBlock, fontSize: "0.75rem" }}>{`POST /api/retention/register      Connect your product
POST /api/retention/push-packet   Push a workflow run
POST /api/retention/sync          Sync QA findings
GET  /api/retention/status        Connection health
GET  /api/retention/packets       List captured runs
POST /api/retention/webhook       Receive events`}</pre>
            </div>
            <div>
              <div style={{
                ...mono,
                fontSize: "0.75rem",
                fontWeight: 700,
                color: TEXT,
                marginBottom: "0.75rem",
                letterSpacing: "0.05em",
              }}>
                MCP TOOLS (6)
              </div>
              <pre style={{ ...codeBlock, fontSize: "0.75rem" }}>{`bp.check          Scan any URL
bp.capture        Save a session as workflow
bp.distill        Compress for cheaper replay
bp.judge.start    Start judging a replay
bp.judge.event    Report what happened
bp.judge.verdict  Get the verdict`}</pre>
            </div>
          </div>
        </section>

        {/* ── GITHUB + LINKS ──────────────────────────────────── */}
        <section style={{ marginBottom: "4rem", textAlign: "center" }}>
          <a
            href="https://github.com/HomenShum/attrition"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...mono,
              fontSize: "0.9375rem",
              color: TEXT,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            github.com/HomenShum/attrition
          </a>
          <div style={{
            ...mono,
            fontSize: "0.75rem",
            color: MUTED,
            marginTop: "0.375rem",
            marginBottom: "1rem",
          }}>
            12 Rust crates &middot; 87 tests &middot; MIT license
          </div>
          <div style={{
            ...mono,
            fontSize: "0.75rem",
            color: MUTED,
            display: "flex",
            justifyContent: "center",
            gap: "1.5rem",
          }}>
            <a href="/docs" style={{ color: MUTED, textDecoration: "none" }}>Docs</a>
            <a href="/improvements" style={{ color: MUTED, textDecoration: "none" }}>Captured Runs</a>
            <a
              href="https://github.com/HomenShum/attrition"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: MUTED, textDecoration: "none" }}
            >
              GitHub
            </a>
          </div>
        </section>

      </div>
    </Layout>
  );
}
