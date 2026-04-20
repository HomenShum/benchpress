/**
 * HeroDemoLoop — auto-playing visual of the triage pipeline on the
 * landing page. Purely client-side animation; no API calls.
 *
 * Cycles through 3 scripted scenarios: each shows a prompt, ticks
 * the checklist steps in order, then reveals the 3-card verdict.
 * Loops indefinitely. Respects prefers-reduced-motion.
 */

import { useEffect, useState } from "react";

type Demo = {
  prompt: string;
  checklist: string[];   // in order
  runtime: string;
  world_model: string;
  intent: string;
};

const DEMOS: Demo[] = [
  {
    prompt:
      "I have a retail inventory agent on Claude Opus 4.7. $20/day. Cut to $2/day.",
    checklist: [
      "Problem type identified",
      "Output contract extracted",
      "Tools / MCP likely needed",
      "Source-of-truth resolved",
      "Eval method selected",
      "Runtime chosen",
    ],
    runtime: "Tool-first chain",
    world_model: "Lite",
    intent: "Compile down",
  },
  {
    prompt:
      "400-line LangChain support agent on GPT-4. Want orchestrator with retries + escalation.",
    checklist: [
      "Problem type identified",
      "Existing assets detected",
      "Tools likely needed",
      "Source-of-truth resolved",
      "Eval method selected",
      "Runtime + world model chosen",
    ],
    runtime: "Orchestrator-worker",
    world_model: "Full",
    intent: "Compile up",
  },
  {
    prompt: "Weekly financial report from a revenue spreadsheet. Email to finance.",
    checklist: [
      "Problem type identified",
      "Output contract extracted",
      "Tools needed",
      "Eval method selected",
      "Runtime chosen — bounded",
      "Don't oversell a scaffold",
    ],
    runtime: "Simple chain",
    world_model: "Lite",
    intent: "Greenfield",
  },
];

const STEP_MS = 420;          // time per checklist tick
const VERDICT_HOLD_MS = 2400; // how long verdict sits before rotating
const PROMPT_FADE_MS = 400;

export function HeroDemoLoop() {
  const [demoIdx, setDemoIdx] = useState(0);
  const [revealCount, setRevealCount] = useState(0);
  const [phase, setPhase] = useState<"prompt" | "ticking" | "verdict">("prompt");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const demo = DEMOS[demoIdx % DEMOS.length];
  const totalSteps = demo.checklist.length;

  // Drive the animation: prompt -> tick -> verdict -> rotate
  useEffect(() => {
    if (reduced) return; // static render, no timers
    let cancelled = false;
    let timers: number[] = [];

    function schedule(fn: () => void, delay: number) {
      timers.push(window.setTimeout(fn, delay));
    }

    setRevealCount(0);
    setPhase("prompt");
    schedule(() => {
      if (cancelled) return;
      setPhase("ticking");
      for (let i = 1; i <= totalSteps; i += 1) {
        schedule(() => {
          if (cancelled) return;
          setRevealCount(i);
          if (i === totalSteps) {
            schedule(() => {
              if (cancelled) return;
              setPhase("verdict");
              schedule(() => {
                if (cancelled) return;
                setDemoIdx((d) => d + 1);
              }, VERDICT_HOLD_MS);
            }, STEP_MS);
          }
        }, i * STEP_MS);
      }
    }, PROMPT_FADE_MS);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [demoIdx, totalSteps, reduced]);

  return (
    <div
      aria-label="Sample triage animation"
      style={{
        padding: 16,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        fontSize: 13,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
          marginBottom: 10,
        }}
      >
        Sample triage ({(demoIdx % DEMOS.length) + 1}/{DEMOS.length})
      </div>

      <div
        style={{
          fontStyle: "italic",
          color: "rgba(255,255,255,0.82)",
          marginBottom: 14,
          lineHeight: 1.5,
          minHeight: 42,
        }}
      >
        “{demo.prompt}”
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, minHeight: 160 }}>
        {demo.checklist.map((step, i) => {
          const shown = reduced || revealCount > i || phase === "verdict";
          return (
            <li
              key={`${demoIdx}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
                fontSize: 12,
                opacity: shown ? 1 : 0.2,
                transition: "opacity 0.25s ease-in",
                color: shown ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  width: 14,
                  height: 14,
                  background: shown ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${shown ? "rgba(34,197,94,0.45)" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 3,
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#22c55e",
                  fontSize: 9,
                }}
              >
                {shown ? "✓" : ""}
              </span>
              {step}
            </li>
          );
        })}
      </ul>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          opacity: reduced || phase === "verdict" ? 1 : 0.25,
          transition: "opacity 0.4s ease-in",
        }}
      >
        <DemoPill label="Runtime" value={demo.runtime} accent="#d97757" />
        <DemoPill label="World model" value={demo.world_model} accent="#8b5cf6" />
        <DemoPill label="Intent" value={demo.intent} accent="#22c55e" />
      </div>
    </div>
  );
}

function DemoPill({
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
        padding: "8px 10px",
        background: `${accent}10`,
        border: `1px solid ${accent}35`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>
        {value}
      </div>
    </div>
  );
}
