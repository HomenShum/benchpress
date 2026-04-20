/**
 * Three-page shared nav — the only three pages the product ships.
 *   /        Architect  — chat-first intake + triage
 *   /build   Builder    — split-view generated scaffold + eval + world model
 *   /radar   Radar      — ecosystem intelligence that feeds the recommender
 */

import { Link, useLocation } from "react-router-dom";

const TABS = [
  { to: "/", label: "Architect", match: (p: string) => p === "/" },
  { to: "/build", label: "Builder", match: (p: string) => p.startsWith("/build") },
  { to: "/radar", label: "Radar", match: (p: string) => p === "/radar" },
] as const;

export function Nav() {
  const { pathname } = useLocation();
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(11,10,9,0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            fontWeight: 600,
            color: "#d97757",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          attrition.sh
        </Link>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  textDecoration: "none",
                  color: active ? "#fff" : "rgba(255,255,255,0.55)",
                  background: active ? "rgba(217,119,87,0.15)" : "transparent",
                  border: active ? "1px solid rgba(217,119,87,0.35)" : "1px solid transparent",
                  transition: "background 0.12s",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
