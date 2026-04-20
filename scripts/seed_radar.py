"""Seed Radar with real Tier-1 ecosystem items we can legitimately attribute.

Each item is a normalized fact about something that has already been
publicly announced or published — not invented content. URLs point to
the canonical source.
"""

from convex import ConvexClient
import time

c = ConvexClient("https://joyous-walrus-428.convex.cloud")

now = int(time.time() * 1000)
day = 86_400_000

SEEDS = [
    {
        "itemId": "release:claude_code:2026-04-17",
        "category": "release",
        "sourceTier": "tier1_official",
        "stack": "claude_code",
        "title": "Claude Code — weekly What's New digest",
        "summary": "Anthropic publishes a weekly changelog of Claude Code updates (hooks, MCP, IDE integrations). Watch for recommender prior shifts.",
        "url": "https://docs.anthropic.com/en/docs/claude-code/changelog",
        "changedAt": now - 2 * day,
        "affectsLanesJson": '["orchestrator_worker"]',
        "updatesPrior": "runtime",
        "suggestedAction": "Push hook / subagent changes into Architect's prior for orchestrator_worker lane.",
    },
    {
        "itemId": "release:openai_agents_sdk:2026-04-11",
        "category": "release",
        "sourceTier": "tier1_official",
        "stack": "openai_agents_sdk",
        "title": "OpenAI Agents SDK — April 2026 update",
        "summary": "Handoff + tool-schema primitives refreshed. Affects translate lane for OpenAI-hosted workflows.",
        "url": "https://platform.openai.com/docs/changelog",
        "changedAt": now - 8 * day,
        "affectsLanesJson": '["orchestrator_worker","tool_first_chain"]',
        "updatesPrior": "runtime",
        "suggestedAction": "When translating to OpenAI Agents SDK, regenerate handoff payloads against the current schema.",
    },
    {
        "itemId": "release:langgraph:2026-04-14",
        "category": "release",
        "sourceTier": "tier1_official",
        "stack": "langgraph",
        "title": "LangGraph 0.6 — graph + memory ergonomics",
        "summary": "Improves state / memory primitives. Raises compile_up target quality from legacy chains.",
        "url": "https://github.com/langchain-ai/langgraph/releases",
        "changedAt": now - 5 * day,
        "affectsLanesJson": '["orchestrator_worker"]',
        "updatesPrior": "runtime",
        "suggestedAction": "Default compile_up target for LangChain-ecosystem users.",
    },
    {
        "itemId": "release:google_adk:2026-04-10",
        "category": "release",
        "sourceTier": "tier1_official",
        "stack": "google_adk",
        "title": "Google ADK — April 2026 release notes",
        "summary": "New multi-agent orchestration patterns. Affects translate lane for Gemini-hosted workflows.",
        "url": "https://google.github.io/adk-docs/",
        "changedAt": now - 9 * day,
        "affectsLanesJson": '["orchestrator_worker","tool_first_chain"]',
        "updatesPrior": "runtime",
        "suggestedAction": "Include ADK as a translate target when the user's workflow uses Gemini + MCP.",
    },
    {
        "itemId": "release:deerflow:2026-04-15",
        "category": "release",
        "sourceTier": "tier1_official",
        "stack": "deerflow",
        "title": "DeerFlow 2.0 — workflow-as-code runtime",
        "summary": "Formalizes orchestrator-worker runtime. Strong compile_up target for legacy LangChain pipelines.",
        "url": "https://github.com/bytedance/deer-flow",
        "changedAt": now - 4 * day,
        "affectsLanesJson": '["orchestrator_worker"]',
        "updatesPrior": "runtime",
        "suggestedAction": "Match handoff primitives against the generated WorkflowSpec.",
    },
    {
        "itemId": "benchmark:swe_bench_verified:opus_4_7_2026-04",
        "category": "benchmark",
        "sourceTier": "tier1_official",
        "stack": "benchmarks",
        "title": "Opus 4.7 reports 87.6% on SWE-bench Verified",
        "summary": "Strong gains on agentic coding. Current ceiling for compile_down on coding scaffolds.",
        "url": "https://www.vellum.ai/blog/claude-opus-4-7-benchmarks-explained",
        "changedAt": now - 12 * day,
        "affectsLanesJson": '["orchestrator_worker","keep_big_model"]',
        "updatesPrior": "eval",
        "suggestedAction": "Use Opus 4.7 as the ceiling in compile_down trials for coding workflows.",
    },
    {
        "itemId": "benchmark:judgebench:2026-03",
        "category": "benchmark",
        "sourceTier": "tier1_official",
        "stack": "benchmarks",
        "title": "JudgeBench — LLM-judge calibration benchmark",
        "summary": "Hard pairwise judge benchmark; many strong judges only slightly above random. Primary Loop A calibration suite.",
        "url": "https://huggingface.co/datasets/ScalerLab/JudgeBench",
        "changedAt": now - 30 * day,
        "affectsLanesJson": '["orchestrator_worker","tool_first_chain","simple_chain"]',
        "updatesPrior": "eval",
        "suggestedAction": "Run the product's rubric judge against JudgeBench quarterly; regression triggers prompt revision.",
    },
    {
        "itemId": "benchmark:if_rewardbench:2026-02",
        "category": "benchmark",
        "sourceTier": "tier1_official",
        "stack": "benchmarks",
        "title": "IF-RewardBench — instruction-following meta-eval",
        "summary": "842 instructions across single-turn, multi-turn, system-prompt steerability. Maps onto named boolean check architecture.",
        "url": "https://huggingface.co/datasets/allenai/IF-RewardBench",
        "changedAt": now - 45 * day,
        "affectsLanesJson": '["orchestrator_worker","tool_first_chain"]',
        "updatesPrior": "eval",
        "suggestedAction": "Validate that each named boolean in the rubric is actually discriminative.",
    },
    {
        "itemId": "benchmark:mcp_atlas:2026-03",
        "category": "benchmark",
        "sourceTier": "tier1_official",
        "stack": "benchmarks",
        "title": "MCP-Atlas — multi-tool orchestration benchmark",
        "summary": "Real MCP servers, 500-task subset, 3-6 tool calls with diagnostics on discovery, parameterization, recovery.",
        "url": "https://github.com/mcp-atlas/mcp-atlas",
        "changedAt": now - 25 * day,
        "affectsLanesJson": '["orchestrator_worker","tool_first_chain"]',
        "updatesPrior": "eval",
        "suggestedAction": "Secondary workflow benchmark; pair with deterministic BFCL AST for parity.",
    },
    {
        "itemId": "benchmark:tau2_bench:2026-02",
        "category": "benchmark",
        "sourceTier": "tier1_official",
        "stack": "benchmarks",
        "title": "τ²-bench — customer-service agent eval",
        "summary": "Policy + tools + tasks + user tools. Retail and telecom domains. Closest public analog to FloorAI retail-ops.",
        "url": "https://github.com/sierra-research/tau2-bench",
        "changedAt": now - 60 * day,
        "affectsLanesJson": '["orchestrator_worker","tool_first_chain"]',
        "updatesPrior": "eval",
        "suggestedAction": "Default benchmark for retail / support-flow compile_up or compile_down recommendations.",
    },
    {
        "itemId": "pattern:world_model:interpretive_boundary:2026-04",
        "category": "pattern",
        "sourceTier": "tier2_interpreter",
        "stack": "world_model",
        "title": "World models need visible interpretive boundaries",
        "summary": "Plausible interpretations must not masquerade as settled truth. Separate act-on-this from interpret-this-first in every surface.",
        "url": "https://youtu.be/fm6mYqFAM5c",
        "changedAt": now - 7 * day,
        "affectsLanesJson": '["orchestrator_worker","tool_first_chain","simple_chain"]',
        "updatesPrior": "world_model",
        "suggestedAction": "Every Builder world-model must emit interpretive_boundary.md. Bake this into scaffold generation.",
    },
    {
        "itemId": "pattern:bfcl_v3_saturation:2026-04",
        "category": "benchmark",
        "sourceTier": "tier1_official",
        "stack": "benchmarks",
        "title": "BFCL v3 is saturated for frontier tool-calling",
        "summary": "Internal falsification: Pro and Flash Lite score within CI noise on simple/multiple/parallel. Need a harder benchmark for scaffold-lift claims.",
        "url": "https://gorilla.cs.berkeley.edu/leaderboard.html",
        "changedAt": now - 1 * day,
        "affectsLanesJson": '["tool_first_chain","orchestrator_worker"]',
        "updatesPrior": "eval",
        "suggestedAction": "Do NOT use BFCL v3 for compile_down claims; route to SWE-bench Verified or tau2-bench.",
    },
    {
        "itemId": "release:hermes_agent:2026-04",
        "category": "watchlist",
        "sourceTier": "tier1_official",
        "stack": "hermes_agent",
        "title": "Hermes Agent — active development heartbeat",
        "summary": "Ongoing work in the Hermes Agent repo. No major release but pattern watch in progress.",
        "url": "https://github.com/NousResearch",
        "changedAt": now - 6 * day,
        "affectsLanesJson": '["orchestrator_worker"]',
        "updatesPrior": "none",
        "suggestedAction": "Track repo activity; surface any new orchestration pattern back into recommender.",
    },
]


def main() -> None:
    ok = fail = 0
    for s in SEEDS:
        try:
            c.mutation("domains/daas/radar:upsertItem", s)
            ok += 1
        except Exception as e:
            fail += 1
            print(f"[err] {s['itemId']}: {e}")
    print(f"seeded: {ok} ok, {fail} failed")


if __name__ == "__main__":
    main()
