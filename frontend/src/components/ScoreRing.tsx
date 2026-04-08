// --------------------------------------------------------------------------
// Circular score display (0-100), color-coded via SVG
// --------------------------------------------------------------------------

interface ScoreRingProps {
  score: number;
  /** Outer diameter in px. Default 120. */
  size?: number;
  /** Stroke width. Default 8. */
  strokeWidth?: number;
  /** Optional label below score number. */
  label?: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e"; // green
  if (score >= 50) return "#eab308"; // yellow
  return "#ef4444"; // red
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  label,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = scoreColor(clamped);

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>

      {/* Centered number overlay */}
      <div
        style={{
          position: "relative",
          marginTop: -size + (size - 28) / 2,
          height: 0,
          textAlign: "center",
          width: size,
        }}
      >
        <span
          style={{
            fontSize: size > 80 ? "2rem" : "1.25rem",
            fontWeight: 700,
            color,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {Math.round(clamped)}
        </span>
      </div>

      {/* Push layout past the SVG */}
      <div style={{ height: size * 0.35 }} />

      {label && (
        <span
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
