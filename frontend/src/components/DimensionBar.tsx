// --------------------------------------------------------------------------
// Horizontal bar for a dimension score (0-100) with label
// --------------------------------------------------------------------------

interface DimensionBarProps {
  label: string;
  score: number;
  /** Optional max value (default 100). */
  max?: number;
}

function barColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

const DIMENSION_LABELS: Record<string, string> = {
  js_errors: "JS Errors",
  accessibility: "Accessibility",
  performance: "Performance",
  layout: "Layout",
  seo: "SEO",
  security: "Security",
};

export function friendlyLabel(key: string): string {
  return DIMENSION_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DimensionBar({ label, score, max = 100 }: DimensionBarProps) {
  const clamped = Math.max(0, Math.min(max, score));
  const pct = (clamped / max) * 100;
  const color = barColor(clamped);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      {/* Label */}
      <span
        style={{
          width: 110,
          flexShrink: 0,
          fontSize: "0.8125rem",
          color: "var(--text-secondary)",
          textAlign: "right",
        }}
      >
        {friendlyLabel(label)}
      </span>

      {/* Track */}
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: 4,
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 4,
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* Score number */}
      <span
        style={{
          width: 36,
          flexShrink: 0,
          textAlign: "right",
          fontSize: "0.8125rem",
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          color,
        }}
      >
        {Math.round(clamped)}
      </span>
    </div>
  );
}
