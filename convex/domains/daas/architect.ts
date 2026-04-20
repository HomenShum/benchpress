// Architect page — chat-first intake + architecture triage action surface.
//
// Three mutations (create session, append turn, commit classification)
// + two queries (by slug, recent list). The heavy classifier call is a
// Node action so it can hit Gemini with streaming-like response.
//
// Agentic reliability:
//   [BOUND]         transcriptJson capped at 64KB, rationale at 4KB.
//   [HONEST_STATUS] runtimeLane/worldModelLane/intentLane must be in the
//                   bounded enums; Convex validator rejects otherwise.
//   [DETERMINISTIC] sessionSlug is a collision-avoiding hex prefix of a
//                   sha256; same prompt at same time collides -> upsert.
//   [SSRF / TIMEOUT] Gemini call happens in the Node action (classify), NOT
//                   in mutations. Mutations only persist.

import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import {
  ARCHITECT_RUNTIME_LANES,
  ARCHITECT_WORLD_MODEL_LANES,
  ARCHITECT_INTENT_LANES,
} from "./schema";

const MAX_TRANSCRIPT_BYTES = 64_000;
const MAX_RATIONALE_BYTES = 4_000;
const VALID_STATUSES = ["intake", "classifying", "ready", "accepted", "dismissed"] as const;

/**
 * Create a new architect session for an incoming prompt.
 * Returns the session's slug for URL routing.
 */
export const createSession = mutation({
  args: {
    sessionSlug: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.prompt.length > 8_000) {
      throw new Error(`prompt too long (${args.prompt.length} > 8000 chars)`);
    }
    const existing = await ctx.db
      .query("architectSessions")
      .withIndex("by_sessionSlug", (q) => q.eq("sessionSlug", args.sessionSlug))
      .unique();
    if (existing) {
      return { id: existing._id, sessionSlug: args.sessionSlug, existing: true };
    }
    const now = Date.now();
    const transcript = JSON.stringify([
      { ts: now, role: "user", content: args.prompt },
    ]);
    const id = await ctx.db.insert("architectSessions", {
      sessionSlug: args.sessionSlug,
      prompt: args.prompt,
      transcriptJson: transcript,
      status: "intake",
      createdAt: now,
      updatedAt: now,
    });
    return { id, sessionSlug: args.sessionSlug, existing: false };
  },
});

/**
 * Append a turn (user or assistant) to a session transcript.
 */
export const appendTurn = mutation({
  args: {
    sessionSlug: v.string(),
    role: v.string(), // "user" | "assistant"
    content: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.role !== "user" && args.role !== "assistant") {
      throw new Error(`invalid role ${args.role}`);
    }
    const row = await ctx.db
      .query("architectSessions")
      .withIndex("by_sessionSlug", (q) => q.eq("sessionSlug", args.sessionSlug))
      .unique();
    if (!row) throw new Error(`session not found: ${args.sessionSlug}`);

    const transcript = JSON.parse(row.transcriptJson) as Array<{
      ts: number;
      role: string;
      content: string;
    }>;
    transcript.push({ ts: Date.now(), role: args.role, content: args.content });
    const nextJson = JSON.stringify(transcript);
    if (nextJson.length > MAX_TRANSCRIPT_BYTES) {
      throw new Error(
        `transcript exceeds ${MAX_TRANSCRIPT_BYTES}B (${nextJson.length}); start a new session`,
      );
    }
    await ctx.db.patch(row._id, {
      transcriptJson: nextJson,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Commit the classifier's streaming checklist + final recommendation.
 * Called by the architect classifier action once it has a verdict.
 */
export const commitClassification = mutation({
  args: {
    sessionSlug: v.string(),
    checklistJson: v.string(),
    classificationJson: v.string(),
    runtimeLane: v.string(),
    worldModelLane: v.string(),
    intentLane: v.string(),
    rationale: v.string(),
  },
  handler: async (ctx, args) => {
    if (
      !ARCHITECT_RUNTIME_LANES.includes(args.runtimeLane as typeof ARCHITECT_RUNTIME_LANES[number])
    ) {
      throw new Error(`invalid runtimeLane ${args.runtimeLane}`);
    }
    if (
      !ARCHITECT_WORLD_MODEL_LANES.includes(
        args.worldModelLane as typeof ARCHITECT_WORLD_MODEL_LANES[number],
      )
    ) {
      throw new Error(`invalid worldModelLane ${args.worldModelLane}`);
    }
    if (
      !ARCHITECT_INTENT_LANES.includes(args.intentLane as typeof ARCHITECT_INTENT_LANES[number])
    ) {
      throw new Error(`invalid intentLane ${args.intentLane}`);
    }
    if (args.rationale.length > MAX_RATIONALE_BYTES) {
      throw new Error(`rationale too long (${args.rationale.length} > ${MAX_RATIONALE_BYTES})`);
    }
    const row = await ctx.db
      .query("architectSessions")
      .withIndex("by_sessionSlug", (q) => q.eq("sessionSlug", args.sessionSlug))
      .unique();
    if (!row) throw new Error(`session not found: ${args.sessionSlug}`);
    await ctx.db.patch(row._id, {
      checklistJson: args.checklistJson,
      classificationJson: args.classificationJson,
      runtimeLane: args.runtimeLane,
      worldModelLane: args.worldModelLane,
      intentLane: args.intentLane,
      rationale: args.rationale,
      status: "ready",
      updatedAt: Date.now(),
    });
  },
});

/**
 * User accepted the recommendation → status moves to "accepted"
 * and the Builder page starts loading the scaffold plan.
 */
export const markAccepted = mutation({
  args: { sessionSlug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("architectSessions")
      .withIndex("by_sessionSlug", (q) => q.eq("sessionSlug", args.sessionSlug))
      .unique();
    if (!row) throw new Error(`session not found: ${args.sessionSlug}`);
    await ctx.db.patch(row._id, { status: "accepted", updatedAt: Date.now() });
  },
});

/**
 * Update status to "classifying" while the Node action runs Gemini.
 * Separate from commitClassification so the UI can show a spinner
 * between intake and ready.
 */
export const markClassifying = mutation({
  args: { sessionSlug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("architectSessions")
      .withIndex("by_sessionSlug", (q) => q.eq("sessionSlug", args.sessionSlug))
      .unique();
    if (!row) throw new Error(`session not found: ${args.sessionSlug}`);
    await ctx.db.patch(row._id, { status: "classifying", updatedAt: Date.now() });
  },
});

/**
 * Fetch a single session by URL slug.
 */
export const getSessionBySlug = query({
  args: { sessionSlug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("architectSessions")
      .withIndex("by_sessionSlug", (q) => q.eq("sessionSlug", args.sessionSlug))
      .unique();
  },
});

/**
 * Recent accepted sessions — for an operator dashboard.
 */
export const listRecentSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 30, 200);
    return await ctx.db
      .query("architectSessions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});
