/**
 * Internal operator view — aggregate telemetry from daasAuditLog.
 * Route: /_internal/telemetry
 *
 * Shows: operations in last 24h/7d by op type, error rate per op,
 * avg latency per op. Pure read from audit log; no new tables.
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../_convex/api";
import { Nav } from "../components/Nav";

export function Telemetry() {
  const [windowHours, setWindowHours] = useState<24 | 168>(24);
  const rollup = useQuery(api.domains.daas.radar.getTelemetryRollup, {
    windowHours,
  });

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
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <main
        id="main"
        style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 80px" }}
      >
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
            Telemetry · internal
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Audit log rollup
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              margin: "8px 0 0",
              lineHeight: 1.5,
            }}
          >
            Every mutating op in the DaaS pipeline writes to{" "}
            <code>daasAuditLog</code>. This page aggregates the last{" "}
            {windowHours === 24 ? "24 hours" : "7 days"} by op.
          </p>
        </header>

        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[
            { label: "24h", value: 24 as const },
            { label: "7d", value: 168 as const },
          ].map((opt) => {
            const active = opt.value === windowHours;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setWindowHours(opt.value)}
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
                {opt.label}
              </button>
            );
          })}
        </div>

        {!rollup ? (
          <div style={{ display: "grid", gap: 8 }} aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />
            ))}
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <StatCard
                label="Total ops"
                value={String(rollup.totalOps)}
                accent="#d97757"
              />
              <StatCard
                label="Errors"
                value={String(rollup.totalErrors)}
                accent={rollup.totalErrors > 0 ? "#ef4444" : "#22c55e"}
              />
              <StatCard
                label="Op types"
                value={String(rollup.byOp.length)}
                accent="#8b5cf6"
              />
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(255,255,255,0.5)",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "10px 14px" }}>op</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>
                      total
                    </th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>
                      ok
                    </th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>
                      error
                    </th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>
                      denied
                    </th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>
                      avg ms
                    </th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>
                      error rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.byOp.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: 20,
                          textAlign: "center",
                          color: "rgba(255,255,255,0.5)",
                        }}
                      >
                        No ops in this window.
                      </td>
                    </tr>
                  ) : (
                    rollup.byOp.map((r, i) => {
                      const errorRate = r.total > 0 ? r.error / r.total : 0;
                      return (
                        <tr
                          key={r.op}
                          style={{
                            borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 14px",
                              fontFamily: "'JetBrains Mono', monospace",
                              color: "rgba(255,255,255,0.85)",
                            }}
                          >
                            {r.op}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}>
                            {r.total}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              textAlign: "right",
                              color: r.ok === r.total ? "#22c55e" : undefined,
                            }}
                          >
                            {r.ok}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              textAlign: "right",
                              color: r.error > 0 ? "#ef4444" : "rgba(255,255,255,0.5)",
                            }}
                          >
                            {r.error}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              textAlign: "right",
                              color: r.denied > 0 ? "#f59e0b" : "rgba(255,255,255,0.5)",
                            }}
                          >
                            {r.denied}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}>
                            {r.avgDurationMs}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              textAlign: "right",
                              color:
                                errorRate > 0.05
                                  ? "#ef4444"
                                  : errorRate > 0
                                    ? "#f59e0b"
                                    : "#22c55e",
                            }}
                          >
                            {(errorRate * 100).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p
          style={{
            marginTop: 20,
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          Also available: <code>/health</code> (JSON) for external monitoring ·{" "}
          <a href="/_internal/fidelity" style={{ color: "#d97757" }}>
            /_internal/fidelity
          </a>{" "}
          for fidelity trial rollups
        </p>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: "rgba(255,255,255,0.95)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
