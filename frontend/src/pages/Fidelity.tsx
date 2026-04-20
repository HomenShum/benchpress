/**
 * Fidelity — transfer-judgment measurement dashboard.
 *
 * Every row is the honest answer to: "can the big model's tacit judgment
 * be externalized into a compile-time artifact the small model executes,
 * and at what fidelity?"
 *
 * The 3-measurement template is the only thing stored:
 *   baseline   = small_model.solo(task)
 *   ceiling    = large_model.solo(task)
 *   distilled  = small_model(task, scaffold=artifact)
 *
 * Verdict is a bounded enum: transfers / lossy / no_gap / regression /
 * insufficient_data. No free-form scores. No LLM judge — the benchmark
 * harness's own deterministic verdict is the source of truth.
 *
 * See:
 *   docs/JUDGE_EVAL_BENCHMARKS.md  (why we chose each benchmark)
 *   docs/BFCL_FALSIFICATION_FINDINGS.md  (why this discipline exists)
 *   daas/fidelity/ (Python trial runner + verdict classifier)
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../_convex/api";

type Verdict =
  | "transfers"
  | "lossy"
  | "no_gap"
  | "regression"
  | "insufficient_data";

const VERDICT_LOOK: Record<
  Verdict,
  { label: string; fg: string; bg: string; border: string; action: string }
> = {
  transfers: {
    label: "TRANSFERS",
    fg: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    border: "rgba(34,197,94,0.4)",
    action: "Ship the scaffold",
  },
  lossy: {
    label: "LOSSY",
    fg: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.4)",
    action: "Redistill or route high-value tasks to big model",
  },
  no_gap: {
    label: "NO GAP",
    fg: "#94a3b8",
    bg: "rgba(148,163,184,0.15)",
    border: "rgba(148,163,184,0.4)",
    action: "Remove scaffold; route to small model solo",
  },
  regression: {
    label: "REGRESSION",
    fg: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.4)",
    action: "Remove scaffold — it hurts",
  },
  insufficient_data: {
    label: "INSUFFICIENT DATA",
    fg: "#64748b",
    bg: "rgba(100,116,139,0.15)",
    border: "rgba(100,116,139,0.4)",
    action: "Run more trials",
  },
};

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function pp(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}pp`;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const look = VERDICT_LOOK[verdict as Verdict] || VERDICT_LOOK.insufficient_data;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 11,
        letterSpacing: "0.1em",
        fontWeight: 600,
        color: look.fg,
        background: look.bg,
        border: `1px solid ${look.border}`,
        borderRadius: 4,
      }}
    >
      {look.label}
    </span>
  );
}

function MeasureBar({
  label,
  rate,
  lo,
  hi,
  colour,
}: {
  label: string;
  rate: number;
  lo: number;
  hi: number;
  colour: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span style={{ width: 86, color: "rgba(255,255,255,0.6)" }}>{label}</span>
      <div
        style={{
          position: "relative",
          flex: 1,
          height: 8,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 4,
        }}
        aria-label={`${label}: ${pct(rate)} [${pct(lo)}, ${pct(hi)}]`}
      >
        {/* CI band */}
        <div
          style={{
            position: "absolute",
            left: `${lo * 100}%`,
            width: `${(hi - lo) * 100}%`,
            top: 0,
            bottom: 0,
            background: `${colour}33`,
            borderRadius: 4,
          }}
        />
        {/* Point estimate */}
        <div
          style={{
            position: "absolute",
            left: `calc(${rate * 100}% - 2px)`,
            top: -2,
            width: 4,
            height: 12,
            background: colour,
            borderRadius: 1,
          }}
        />
      </div>
      <span style={{ width: 68, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {pct(rate)}
      </span>
      <span
        style={{
          width: 120,
          textAlign: "right",
          fontSize: 11,
          color: "rgba(255,255,255,0.5)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        [{pct(lo)}, {pct(hi)}]
      </span>
    </div>
  );
}

export function Fidelity() {
  const latest = useQuery(api.domains.daas.fidelity.listLatestVerdicts, { limit: 50 });
  const externs = useQuery(api.domains.daas.fidelity.listExternalizations, { limit: 100 });
  const [selectedExt, setSelectedExt] = useState<string | null>(null);

  const trials = useQuery(
    api.domains.daas.fidelity.listTrials,
    selectedExt ? { externalizationId: selectedExt, limit: 200 } : "skip",
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0a09",
        color: "rgba(255,255,255,0.92)",
        fontFamily:
          "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "40px 48px",
      }}
    >
      <a
        href="#main"
        style={{
          position: "absolute",
          top: -40,
          left: 0,
          padding: 8,
          background: "#d97757",
          color: "#fff",
          textDecoration: "none",
        }}
      >
        Skip to content
      </a>

      <header style={{ maxWidth: 1200, margin: "0 auto 32px" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#d97757",
            marginBottom: 6,
          }}
        >
          Fidelity
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
          Transfer judgment from runtime to compile-time
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.6)",
            margin: "6px 0 0",
            maxWidth: 780,
          }}
        >
          Every externalized distillation artifact — prompt, tool schema, scaffold graph —
          is tested against the 3-measurement template on a ground-truth benchmark.
          Verdicts are bounded to five enums. No free-form scores, no LLM judge.
          If the CI doesn't exclude zero, the verdict says so.
        </p>
      </header>

      <main id="main" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 12,
            }}
          >
            Latest verdicts ({latest?.length ?? 0})
          </h2>

          {!latest ? (
            <div
              style={{
                padding: 16,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Loading…
            </div>
          ) : latest.length === 0 ? (
            <div
              style={{
                padding: 20,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                fontSize: 13,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              No fidelity verdicts recorded yet. Run{" "}
              <code style={{ color: "#d97757", fontFamily: "monospace" }}>
                python -m daas.fidelity.cli --record …
              </code>{" "}
              to publish one.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {latest.map((v) => (
                <article
                  key={v._id}
                  style={{
                    padding: 18,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setSelectedExt((prev) =>
                      prev === v.externalizationId ? null : v.externalizationId,
                    )
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedExt((prev) =>
                        prev === v.externalizationId ? null : v.externalizationId,
                      );
                    }
                  }}
                  aria-label={`Verdict ${v.verdict} for ${v.externalizationId} on ${v.benchmarkId}`}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <VerdictBadge verdict={v.verdict} />
                      <div style={{ fontSize: 15, fontWeight: 500 }}>
                        {v.externalizationId}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.45)",
                          fontFamily: "monospace",
                        }}
                      >
                        → {v.benchmarkId}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.4)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      n={v.n} · cost ${v.totalCostUsd.toFixed(4)}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <MeasureBar
                      label="baseline"
                      rate={v.baselineRate}
                      lo={v.baselineCiLo}
                      hi={v.baselineCiHi}
                      colour="#94a3b8"
                    />
                    <MeasureBar
                      label="ceiling"
                      rate={v.ceilingRate}
                      lo={v.ceilingCiLo}
                      hi={v.ceilingCiHi}
                      colour="#d97757"
                    />
                    <MeasureBar
                      label="distilled"
                      rate={v.distilledRate}
                      lo={v.distilledCiLo}
                      hi={v.distilledCiHi}
                      colour="#22c55e"
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 16,
                      fontSize: 12,
                      color: "rgba(255,255,255,0.6)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <span>
                      gap{" "}
                      <strong style={{ color: "#d97757" }}>{pp(v.gapPp)}</strong>
                      {v.gapSignificant ? " (sig)" : " (noise)"}
                    </span>
                    <span>
                      transfer{" "}
                      <strong style={{ color: "#22c55e" }}>{pp(v.transferPp)}</strong>
                      {v.transferSignificant ? " (sig)" : " (noise)"}
                    </span>
                    {v.fidelityPct !== undefined && v.fidelityPct !== null ? (
                      <span>
                        fidelity{" "}
                        <strong style={{ color: "#fff" }}>
                          {(v.fidelityPct * 100).toFixed(0)}%
                        </strong>
                      </span>
                    ) : null}
                  </div>

                  <p
                    style={{
                      margin: "12px 0 0",
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    {v.narrative}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {selectedExt && trials && trials.length > 0 ? (
          <section style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 12,
              }}
            >
              Per-task trials ({trials.length}) — {selectedExt}
            </h2>
            <div
              style={{
                overflow: "auto",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
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
                      textAlign: "left",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    <th style={{ padding: "8px 12px" }}>task</th>
                    <th style={{ padding: "8px 12px" }}>baseline</th>
                    <th style={{ padding: "8px 12px" }}>ceiling</th>
                    <th style={{ padding: "8px 12px" }}>distilled</th>
                    <th style={{ padding: "8px 12px" }}>scaffold Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {trials.map((t) => {
                    const delta = Number(t.distilledPassed) - Number(t.baselinePassed);
                    return (
                      <tr
                        key={t._id}
                        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <td
                          style={{
                            padding: "6px 12px",
                            fontFamily: "monospace",
                            color: "rgba(255,255,255,0.7)",
                          }}
                        >
                          {t.taskId}
                        </td>
                        <td style={{ padding: "6px 12px" }}>
                          {t.baselinePassed ? "✓" : "✗"}
                          {t.baselineError ? (
                            <span
                              style={{ marginLeft: 6, color: "#ef4444", fontSize: 10 }}
                            >
                              err
                            </span>
                          ) : null}
                        </td>
                        <td style={{ padding: "6px 12px" }}>
                          {t.ceilingPassed ? "✓" : "✗"}
                          {t.ceilingError ? (
                            <span
                              style={{ marginLeft: 6, color: "#ef4444", fontSize: 10 }}
                            >
                              err
                            </span>
                          ) : null}
                        </td>
                        <td style={{ padding: "6px 12px" }}>
                          {t.distilledPassed ? "✓" : "✗"}
                          {t.distilledError ? (
                            <span
                              style={{ marginLeft: 6, color: "#ef4444", fontSize: 10 }}
                            >
                              err
                            </span>
                          ) : null}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            color:
                              delta > 0
                                ? "#22c55e"
                                : delta < 0
                                  ? "#ef4444"
                                  : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {delta > 0 ? "+1 helped" : delta < 0 ? "-1 hurt" : "·"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section
          style={{
            padding: 18,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <div style={{ marginBottom: 6, color: "rgba(255,255,255,0.8)", fontSize: 13 }}>
            How to add a new externalization
          </div>
          <code
            style={{
              display: "block",
              fontFamily: "'JetBrains Mono', monospace",
              padding: 12,
              background: "rgba(0,0,0,0.3)",
              borderRadius: 4,
              whiteSpace: "pre",
              overflow: "auto",
            }}
          >
            {`python -m daas.fidelity.cli \\
  --benchmark mmlu_pro \\
  --externalization-id my_prompt_v1 \\
  --form prompt \\
  --artifact daas/fidelity/artifacts/my_prompt_v1.json \\
  --source-model gemini-3.1-pro-preview \\
  --small-model gemini-3.1-flash-lite-preview \\
  --large-model gemini-3.1-pro-preview \\
  --limit 60 --record`}
          </code>
          <div style={{ marginTop: 8 }}>
            Registered externalizations: <strong>{externs?.length ?? 0}</strong>
          </div>
        </section>
      </main>
    </div>
  );
}
