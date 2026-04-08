import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { health as fetchHealth } from "../lib/api";
import type { HealthData } from "../lib/api";
import { listRuns, clearRuns, type QaRun } from "../lib/storage";

export function Dashboard() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [runs, setRuns] = useState<QaRun[]>([]);

  const refreshRuns = useCallback(() => {
    setRuns(listRuns());
  }, []);

  useEffect(() => {
    fetchHealth()
      .then(setHealthData)
      .catch(() => setHealthError(true));
    refreshRuns();
  }, [refreshRuns]);

  const handleClear = () => {
    clearRuns();
    refreshRuns();
  };

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Layout>
      <div
        style={{
          maxWidth: 1024,
          margin: "0 auto",
          padding: "2rem 1.5rem",
        }}
      >
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: "1.5rem",
          }}
        >
          Dashboard
        </h1>

        {/* Health status card */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          <MetricCard
            label="Status"
            value={
              healthError ? "Offline" : healthData?.status === "ok" ? "Online" : "..."
            }
            color={
              healthError
                ? "#ef4444"
                : healthData?.status === "ok"
                  ? "#22c55e"
                  : "var(--text-muted)"
            }
          />
          <MetricCard
            label="Version"
            value={healthData?.version ?? "--"}
          />
          <MetricCard
            label="Uptime"
            value={
              healthData
                ? formatDuration(healthData.uptime_secs * 1000)
                : "--"
            }
          />
          <MetricCard
            label="Requests Served"
            value={healthData?.requests_served?.toString() ?? "--"}
          />
        </div>

        {/* Recent Runs */}
        <div
          style={{
            borderRadius: "0.75rem",
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
              Recent Runs
            </h2>
            {runs.length > 0 && (
              <button
                onClick={handleClear}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Clear History
              </button>
            )}
          </div>

          {/* Table or empty state */}
          {runs.length === 0 ? (
            <div
              style={{
                padding: "3rem 1.5rem",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9375rem",
                  marginBottom: "1rem",
                }}
              >
                No runs yet.
              </p>
              <Link
                to="/"
                style={{
                  display: "inline-block",
                  padding: "0.625rem 1.5rem",
                  borderRadius: "0.5rem",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Run your first QA check
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.875rem",
                }}
              >
                <thead>
                  <tr>
                    {["URL", "Score", "Issues", "Duration", "Date", ""].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "0.625rem 1rem",
                            textAlign: "left",
                            fontWeight: 600,
                            fontSize: "0.6875rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "var(--text-muted)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          maxWidth: 280,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {run.url}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontFamily: "'JetBrains Mono', monospace",
                            color:
                              run.score >= 80
                                ? "#22c55e"
                                : run.score >= 50
                                  ? "#eab308"
                                  : "#ef4444",
                          }}
                        >
                          {run.score}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {run.issueCount}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          color: "var(--text-secondary)",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "0.8125rem",
                        }}
                      >
                        {formatDuration(run.durationMs)}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          color: "var(--text-muted)",
                          fontSize: "0.8125rem",
                        }}
                      >
                        {formatDate(run.timestamp)}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <Link
                          to={`/results/${run.id}`}
                          style={{
                            color: "var(--accent)",
                            textDecoration: "none",
                            fontWeight: 500,
                            fontSize: "0.8125rem",
                          }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// --- Internal metric card ---

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div
        style={{
          fontSize: "0.6875rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-muted)",
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.375rem",
          fontWeight: 700,
          color: color ?? "var(--text-primary)",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
}
