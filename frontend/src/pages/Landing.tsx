import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useEffect } from "react";
import { seedDemoData } from "../lib/demo-data";

const HOOK_FEATURES: { title: string; desc: string }[] = [
  {
    title: "on-prompt",
    desc: "Detects workflow patterns in your prompt. Injects required steps into agent context before work begins.",
  },
  {
    title: "on-tool-use",
    desc: "Tracks every tool call as evidence. Nudges the agent when required steps are missing after 20+ calls.",
  },
  {
    title: "on-stop",
    desc: "Full completion judge before the agent stops. Blocks if mandatory steps are missing. No silent failures.",
  },
  {
    title: "on-session-start",
    desc: "Resumes incomplete workflows from prior sessions. Memory persists across restarts.",
  },
];

const PROVIDER_BADGES = [
  "Claude Code", "Cursor", "Windsurf", "OpenAI Agents SDK",
  "Anthropic SDK", "LangChain", "CrewAI", "PydanticAI",
];

const VALUE_CARDS: { title: string; desc: string; icon: string; accent?: boolean }[] = [
  {
    title: "Always-On Judge",
    desc: "4-hook lifecycle fires on every prompt, tool call, stop, and session start. Zero manual invocation. The judge runs whether you remember or not.",
    icon: "\u25C6",
    accent: true,
  },
  {
    title: "Workflow Memory",
    desc: "Every session becomes a replayable workflow. Canonical events (tool calls, decisions, file edits) stored in local SQLite. Nothing is lost.",
    icon: "\u25CF",
  },
  {
    title: "Self-Improving",
    desc: "Inspired by Meta's HyperAgents: corrections feed back into workflow definitions. The judge learns what steps get missed and tightens enforcement.",
    icon: "\u25B2",
  },
  {
    title: "Distill + Replay",
    desc: "Compress frontier workflows 40-65%. Replay on cheaper models. Judge enforces correctness during replay, nudges on divergence.",
    icon: "\u25A0",
  },
];

export function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    seedDemoData();
  }, []);

  return (
    <Layout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "4rem 1.5rem 2rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 780, width: "100%" }}>
          {/* Hero */}
          <h1
            style={{
              fontSize: "3.5rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              marginBottom: "0.75rem",
            }}
          >
            att
            <span style={{ color: "var(--accent)" }}>rition</span>
          </h1>

          <p
            style={{
              fontSize: "1.375rem",
              fontWeight: 500,
              color: "var(--text-primary)",
              lineHeight: 1.4,
              marginBottom: "0.75rem",
            }}
          >
            The always-on judge for AI agents.
          </p>

          <p
            style={{
              fontSize: "1.0625rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: "2rem",
              maxWidth: 600,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            One command. Invisible hooks. Every agent session is tracked,
            judged, and improved. Works with Claude Code, Cursor, OpenAI,
            LangChain, and any MCP-compatible agent.
          </p>

          {/* Install — the hero action */}
          <div
            style={{
              padding: "1.5rem 2rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(217,119,87,0.3)",
              background: "rgba(217,119,87,0.04)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.9375rem",
              textAlign: "center",
              maxWidth: 480,
              marginLeft: "auto",
              marginRight: "auto",
              marginBottom: "1rem",
            }}
          >
            <span style={{ color: "var(--accent)" }}>$</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>
              curl -sL attrition.sh/install | bash
            </span>
          </div>

          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-muted)",
              marginBottom: "2.5rem",
            }}
          >
            Installs hooks into your agent. Judge activates automatically. No config needed.
          </p>

          {/* CTA buttons */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              marginBottom: "3.5rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => navigate("/judge")}
              style={{
                padding: "0.875rem 2.25rem",
                borderRadius: "0.75rem",
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View Judge Dashboard
            </button>
            <button
              onClick={() => navigate("/workflows")}
              style={{
                padding: "0.875rem 2.25rem",
                borderRadius: "0.75rem",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: "1rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Workflow Memory
            </button>
          </div>

          {/* 4-Hook Lifecycle */}
          <div style={{ marginBottom: "3rem", textAlign: "left", maxWidth: 680, marginLeft: "auto", marginRight: "auto" }}>
            <h2
              style={{
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "var(--text-muted)",
                marginBottom: "1rem",
                textAlign: "center",
              }}
            >
              4-Hook Lifecycle
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {HOOK_FEATURES.map((hook) => (
                <div
                  key={hook.title}
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "0.625rem",
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                  }}
                >
                  <code
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--accent)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {hook.title}
                  </code>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                      margin: "0.5rem 0 0",
                    }}
                  >
                    {hook.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Value props */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              maxWidth: 780,
              marginLeft: "auto",
              marginRight: "auto",
              marginBottom: "3rem",
            }}
          >
            {VALUE_CARDS.map((card) => (
              <div
                key={card.title}
                style={{
                  padding: "1.5rem 1.25rem",
                  borderRadius: "0.75rem",
                  border: card.accent
                    ? "1px solid rgba(217,119,87,0.25)"
                    : "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "0.5rem",
                    background: card.accent ? "rgba(217,119,87,0.12)" : "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.875rem",
                    color: card.accent ? "var(--accent)" : "var(--text-secondary)",
                    marginBottom: "0.875rem",
                  }}
                >
                  {card.icon}
                </div>
                <h3
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    marginBottom: "0.5rem",
                    color: card.accent ? "var(--accent)" : "var(--text-primary)",
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {card.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Provider agnostic badges */}
          <div style={{ marginBottom: "3rem" }}>
            <h2
              style={{
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "var(--text-muted)",
                marginBottom: "1rem",
              }}
            >
              Works with every agent runtime
            </h2>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {PROVIDER_BADGES.map((name) => (
                <span
                  key={name}
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: "2rem",
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    fontWeight: 500,
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div
            style={{
              padding: "1.5rem 2rem",
              borderRadius: "0.75rem",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              textAlign: "left",
              maxWidth: 580,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <div style={{ color: "var(--text-muted)", marginBottom: "0.375rem" }}>
              # Install (one time, 30 seconds)
            </div>
            <div>
              <span style={{ color: "var(--accent)" }}>$</span> curl -sL
              attrition.sh/install | bash
            </div>
            <div style={{ marginTop: "1rem", color: "var(--text-muted)" }}>
              # That's it. Judge hooks activate automatically.
            </div>
            <div style={{ marginTop: "0.375rem", color: "var(--text-muted)" }}>
              # Every session is now tracked and judged.
            </div>
            <div style={{ marginTop: "1rem", color: "var(--text-muted)" }}>
              # View your workflows
            </div>
            <div>
              <span style={{ color: "var(--accent)" }}>$</span> bp workflows
            </div>
            <div style={{ marginTop: "0.75rem", color: "var(--text-muted)" }}>
              # Distill a frontier workflow for cheaper replay
            </div>
            <div>
              <span style={{ color: "var(--accent)" }}>$</span> bp distill
              --target sonnet-4-6
            </div>
            <div style={{ marginTop: "0.75rem", color: "var(--text-muted)" }}>
              # Self-improving: corrections tighten the judge
            </div>
            <div>
              <span style={{ color: "var(--accent)" }}>$</span> bp judge
              --show-corrections
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
