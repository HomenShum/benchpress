// --------------------------------------------------------------------------
// QA Issue card — severity badge, title, description, optional selector
// --------------------------------------------------------------------------

import type { QaIssue } from "../lib/api";

const SEVERITY_COLORS: Record<QaIssue["severity"], string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#6b7280",
};

const SEVERITY_ORDER: Record<QaIssue["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/** Sort issues by severity (critical first). */
export function sortIssues(issues: QaIssue[]): QaIssue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

export function IssueCard({ issue }: { issue: QaIssue }) {
  const color = SEVERITY_COLORS[issue.severity];

  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Severity badge */}
        <span
          style={{
            display: "inline-block",
            padding: "0.125rem 0.5rem",
            borderRadius: "9999px",
            fontSize: "0.6875rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#fff",
            background: color,
            lineHeight: 1.6,
          }}
        >
          {issue.severity}
        </span>

        {/* Title */}
        <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
          {issue.title}
        </span>
      </div>

      {/* Description */}
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.875rem",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {issue.description}
      </p>

      {/* Selector (if present) */}
      {issue.selector && (
        <code
          style={{
            display: "inline-block",
            padding: "0.25rem 0.5rem",
            borderRadius: "0.375rem",
            background: "var(--bg-elevated)",
            fontSize: "0.8125rem",
            color: "var(--text-muted)",
            wordBreak: "break-all",
          }}
        >
          {issue.selector}
        </code>
      )}
    </div>
  );
}
