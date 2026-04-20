/**
 * Radar — normalized architecture intelligence.
 *
 * Not an AI news feed. Every row tells the user:
 *   - what changed
 *   - which stacks it affects
 *   - which internal prior it updates (runtime / eval / world_model)
 *   - what attrition suggests doing about it
 *
 * Filter pills: Releases · Benchmarks · Patterns · Deprecations · Watchlist
 * Source tier is surfaced per-row (tier1_official / tier2_interpreter /
 * tier3_weak) so the user can see the confidence level at a glance.
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../_convex/api";
import { Nav } from "../components/Nav";

type Category = "all" | "release" | "benchmark" | "pattern" | "deprecation" | "watchlist";

const CATEGORY_LABEL: Record<Category, string> = {
  all: "All",
  release: "Releases",
  benchmark: "Benchmarks",
  pattern: "Patterns",
  deprecation: "Deprecations",
  watchlist: "Watchlist",
};

const TIER_LOOK: Record<string, { label: string; color: string }> = {
  tier1_official: { label: "official", color: "#22c55e" },
  tier2_interpreter: { label: "interpreter", color: "#f59e0b" },
  tier3_weak: { label: "weak signal", color: "#94a3b8" },
};

const PRIOR_LOOK: Record<string, { label: string; color: string }> = {
  runtime: { label: "runtime prior", color: "#d97757" },
  eval: { label: "eval prior", color: "#8b5cf6" },
  world_model: { label: "world-model prior", color: "#06b6d4" },
  none: { label: "heartbeat", color: "#64748b" },
};

export function Radar() {
  const [category, setCategory] = useState<Category>("all");

  const items = useQuery(api.domains.daas.radar.listItems, {
    category: category === "all" ? undefined : category,
    limit: 100,
  });
  const counts = useQuery(api.domains.daas.radar.getCategoryCounts, {});

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0a09",
        color: "rgba(255,255,255,0.92)",
        fontFamily: "'Manrope', -apple-system, sans-serif",
      }}
    >
      <Nav />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 80px" }}>
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#d97757",
              marginBottom: 6,
            }}
          >
            Radar
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
            Architecture intelligence, not AI news.
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.6)",
              margin: "8px 0 0",
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Each item is normalized into what changed, which stacks it affects,
            which internal prior it updates, and what you should do about it.
            Tier 1 is official (changelogs, releases, leaderboards). Tier 2 is
            interpreters. Tier 3 is weak signal — never used alone.
          </p>
        </header>

        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => {
            const active = c === category;
            const n =
              c === "all"
                ? counts
                  ? Object.values(counts).reduce((s, v) => s + (v as number), 0)
                  : 0
                : counts?.[c] ?? 0;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: active
                    ? "1px solid rgba(217,119,87,0.45)"
                    : "1px solid rgba(255,255,255,0.1)",
                  background: active ? "rgba(217,119,87,0.12)" : "rgba(255,255,255,0.02)",
                  color: active ? "#fff" : "rgba(255,255,255,0.7)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {CATEGORY_LABEL[c]}{" "}
                <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>{n}</span>
              </button>
            );
          })}
        </div>

        {items === undefined ? (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: 20,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
              color: "rgba(255,255,255,0.55)",
              fontSize: 13,
            }}
          >
            No {CATEGORY_LABEL[category].toLowerCase()} items recorded yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((item) => {
              const tierLook = TIER_LOOK[item.sourceTier] ?? TIER_LOOK.tier3_weak;
              const priorLook = PRIOR_LOOK[item.updatesPrior] ?? PRIOR_LOOK.none;
              const lanes: string[] = (() => {
                try {
                  return JSON.parse(item.affectsLanesJson);
                } catch {
                  return [];
                }
              })();
              return (
                <article
                  key={item._id}
                  style={{
                    padding: 18,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 16,
                      marginBottom: 8,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "rgba(255,255,255,0.92)", textDecoration: "none" }}
                      >
                        {item.title}
                      </a>
                    </h3>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <Badge label={tierLook.label} color={tierLook.color} />
                      <Badge label={priorLook.label} color={priorLook.color} />
                    </div>
                  </div>
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.7)",
                      lineHeight: 1.5,
                    }}
                  >
                    {item.summary}
                  </p>
                  {item.suggestedAction ? (
                    <div
                      style={{
                        padding: 10,
                        background: "rgba(217,119,87,0.06)",
                        border: "1px solid rgba(217,119,87,0.2)",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.8)",
                        lineHeight: 1.5,
                        marginBottom: 10,
                      }}
                    >
                      <strong style={{ color: "#d97757" }}>Suggested: </strong>
                      {item.suggestedAction}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.45)",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.stack}
                    </span>
                    <span>{new Date(item.changedAt).toLocaleDateString()}</span>
                    {lanes.length > 0 ? (
                      <span>
                        affects: {lanes.map((l) => l.replace(/_/g, " ")).join(", ")}
                      </span>
                    ) : null}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginLeft: "auto",
                        color: "#d97757",
                        textDecoration: "none",
                        fontSize: 11,
                      }}
                    >
                      source →
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 600,
        color,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        borderRadius: 4,
      }}
    >
      {label}
    </span>
  );
}
