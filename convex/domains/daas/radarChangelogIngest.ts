// HTML changelog scrapers for the 4 big vendor changelog pages.
//
// Scope-controlled: we extract a SMALL set of known-structure fields
// from each page (most-recent version tag + 1-line summary). When the
// page's HTML structure shifts, we gracefully skip that source rather
// than flood the Radar with noise.
//
// Sources (all tier1_official):
//   Anthropic   — docs changelog for Claude Code weekly updates
//   OpenAI      — platform docs changelog
//   Google      — ADK release notes page
//   Vellum      — blog feed (tier2_interpreter; kept here for one cron)

"use node";

import { v } from "convex/values";
import { action, internalAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PER_SOURCE = 3;
const SUMMARY_MAX = 280;


type ScrapeSource = {
  id: string;                      // stable id slug for itemId prefix
  url: string;
  stack: string;
  category: "release" | "pattern" | "benchmark";
  sourceTier: "tier1_official" | "tier2_interpreter";
  updatesPrior: "runtime" | "eval" | "world_model" | "none";
  suggestedAction?: string;
  /**
   * Extractor — given the raw HTML, return up to N items. Returning
   * an empty array is a legitimate "we found nothing to ingest"
   * signal; the runner treats it as success.
   */
  extract: (html: string) => Array<{ title: string; summary: string; itemKey: string }>;
};


function truncate(s: string, max: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}


// Strip HTML tags + decode basic entities for clean text summaries.
function textify(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}


// Anthropic Claude Code changelog — docs site. Pull most recent h2/h3 +
// following paragraph as the summary. Structure can drift; we guard.
function extractAnthropic(html: string): Array<{ title: string; summary: string; itemKey: string }> {
  const out: Array<{ title: string; summary: string; itemKey: string }> = [];
  // Each release block is a heading with date-like text
  const regex = /<h[23][^>]*>([^<]+)<\/h[23]>([\s\S]{0,2000}?)(?=<h[23]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null && out.length < MAX_PER_SOURCE) {
    const title = textify(m[1]);
    if (!title) continue;
    // Only keep if it looks like a version/date heading
    if (!/\d/.test(title)) continue;
    const summary = truncate(textify(m[2]), SUMMARY_MAX);
    if (!summary) continue;
    out.push({
      title: `Claude Code — ${title}`,
      summary,
      itemKey: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
    });
  }
  return out;
}


// OpenAI API changelog. Pulls from /docs/changelog. Similar heading pattern.
function extractOpenAI(html: string): Array<{ title: string; summary: string; itemKey: string }> {
  const out: Array<{ title: string; summary: string; itemKey: string }> = [];
  const regex = /<h[23][^>]*>([^<]+)<\/h[23]>([\s\S]{0,1500}?)(?=<h[23]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null && out.length < MAX_PER_SOURCE) {
    const title = textify(m[1]);
    if (!title || title.length < 3) continue;
    // Skip navigation headings
    if (/changelog|documentation|overview|recent updates/i.test(title)) continue;
    if (!/\d/.test(title)) continue;
    const summary = truncate(textify(m[2]), SUMMARY_MAX);
    if (!summary) continue;
    out.push({
      title: `OpenAI API — ${title}`,
      summary,
      itemKey: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
    });
  }
  return out;
}


// Google ADK release notes — docs page. Similar pattern.
function extractGoogleAdk(html: string): Array<{ title: string; summary: string; itemKey: string }> {
  const out: Array<{ title: string; summary: string; itemKey: string }> = [];
  const regex = /<h[234][^>]*>([^<]+)<\/h[234]>([\s\S]{0,1500}?)(?=<h[234]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null && out.length < MAX_PER_SOURCE) {
    const title = textify(m[1]);
    if (!title) continue;
    if (!/\d/.test(title)) continue;
    const summary = truncate(textify(m[2]), SUMMARY_MAX);
    if (!summary) continue;
    out.push({
      title: `Google ADK — ${title}`,
      summary,
      itemKey: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
    });
  }
  return out;
}


// Vellum blog feed — RSS/Atom. We pull the most recent entries.
function extractVellumRss(html: string): Array<{ title: string; summary: string; itemKey: string }> {
  const out: Array<{ title: string; summary: string; itemKey: string }> = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(html)) !== null && out.length < MAX_PER_SOURCE) {
    const block = m[1];
    const titleMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(block);
    const descMatch = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(block);
    const linkMatch = /<link[^>]*>([^<]+)<\/link>/i.exec(block);
    const title = truncate(textify(titleMatch?.[1] || ""), 180);
    if (!title) continue;
    // Only match agent-relevant Vellum posts (keyword filter on title)
    if (
      !/agent|llm|benchmark|opus|claude|gpt|gemini|mcp|tool/i.test(title)
    ) {
      continue;
    }
    const summary = truncate(textify(descMatch?.[1] || ""), SUMMARY_MAX);
    const linkKey = (linkMatch?.[1] || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    out.push({ title: `Vellum — ${title}`, summary, itemKey: linkKey });
  }
  return out;
}


const SOURCES: ScrapeSource[] = [
  {
    id: "anthropic_changelog",
    url: "https://docs.anthropic.com/en/docs/claude-code/changelog",
    stack: "claude_code",
    category: "release",
    sourceTier: "tier1_official",
    updatesPrior: "runtime",
    suggestedAction:
      "If hooks, subagents, or MCP shape changed, re-run the 30-prompt classifier gold set to confirm no runtime-lane regression.",
    extract: extractAnthropic,
  },
  {
    id: "openai_changelog",
    url: "https://platform.openai.com/docs/changelog",
    stack: "openai_agents_sdk",
    category: "release",
    sourceTier: "tier1_official",
    updatesPrior: "runtime",
    suggestedAction:
      "When translating to OpenAI Agents SDK, regenerate handoff payloads against the current schema.",
    extract: extractOpenAI,
  },
  {
    id: "google_adk_notes",
    url: "https://google.github.io/adk-docs/",
    stack: "google_adk",
    category: "release",
    sourceTier: "tier1_official",
    updatesPrior: "runtime",
    suggestedAction: "Include ADK as a translate target for Gemini + MCP workflows.",
    extract: extractGoogleAdk,
  },
  {
    id: "vellum_blog",
    url: "https://www.vellum.ai/blog/rss.xml",
    stack: "benchmarks",
    category: "pattern",
    sourceTier: "tier2_interpreter",
    updatesPrior: "eval",
    suggestedAction:
      "Vellum is tier-2 interpretation. Confirm the underlying benchmark (tier-1) before updating eval priors.",
    extract: extractVellumRss,
  },
];


type ChangelogIngestReport = {
  sourcesChecked: number;
  totalCandidates: number;
  upserted: number;
  updated: number;
  errors: Array<{ source: string; message: string }>;
  runMs: number;
};


async function fetchText(url: string): Promise<string> {
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "attrition-radar-changelog-ingest",
      "Accept": "text/html,application/xml;q=0.9,application/rss+xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }
  return resp.text();
}


export const ingestChangelogs = action({
  args: {},
  handler: async (ctx): Promise<ChangelogIngestReport> => {
    const started = Date.now();
    const errors: ChangelogIngestReport["errors"] = [];
    let totalCandidates = 0;
    let upserted = 0;
    let updated = 0;

    for (const src of SOURCES) {
      let html = "";
      try {
        html = await fetchText(src.url);
      } catch (err) {
        errors.push({ source: src.id, message: String(err).slice(0, 300) });
        continue;
      }
      let items: ReturnType<typeof src.extract> = [];
      try {
        items = src.extract(html);
      } catch (err) {
        errors.push({
          source: src.id,
          message: `extractor_error: ${String(err).slice(0, 200)}`,
        });
        continue;
      }
      totalCandidates += items.length;
      const now = Date.now();
      for (const it of items) {
        try {
          const res = await ctx.runMutation(api.domains.daas.radar.upsertItem, {
            itemId: `${src.category}:${src.stack}:${src.id}:${it.itemKey}`,
            category: src.category,
            sourceTier: src.sourceTier,
            stack: src.stack,
            title: it.title,
            summary: it.summary,
            url: src.url,
            changedAt: now,
            affectsLanesJson: JSON.stringify(
              src.stack === "benchmarks" ? ["orchestrator_worker"] : ["orchestrator_worker", "tool_first_chain"],
            ),
            updatesPrior: src.updatesPrior,
            ...(src.suggestedAction ? { suggestedAction: src.suggestedAction } : {}),
          });
          if (res?.updated) updated += 1;
          else upserted += 1;
        } catch (err) {
          errors.push({
            source: `${src.id}:${it.itemKey}`,
            message: String(err).slice(0, 200),
          });
        }
      }
    }

    return {
      sourcesChecked: SOURCES.length,
      totalCandidates,
      upserted,
      updated,
      errors,
      runMs: Date.now() - started,
    };
  },
});


export const ingestChangelogsInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<ChangelogIngestReport> => {
    const started = Date.now();
    const report = (await ctx.runAction(
      api.domains.daas.radarChangelogIngest.ingestChangelogs,
      {},
    )) as ChangelogIngestReport;
    try {
      const auditArgs: {
        op: string;
        actorKind: string;
        status: string;
        metaJson: string;
        durationMs: number;
        errorMessage?: string;
      } = {
        op: "radar.ingestChangelogs",
        actorKind: "cron",
        status: report.errors.length === 0 ? "ok" : "error",
        metaJson: JSON.stringify({
          sourcesChecked: report.sourcesChecked,
          totalCandidates: report.totalCandidates,
          upserted: report.upserted,
          updated: report.updated,
          errorCount: report.errors.length,
        }),
        durationMs: Date.now() - started,
      };
      if (report.errors.length > 0) {
        auditArgs.errorMessage = `${report.errors.length} source(s) failed; first: ${report.errors[0].message.slice(0, 120)}`;
      }
      await ctx.runMutation(internal.domains.daas.mutations.logAuditEvent, auditArgs);
    } catch {
      // Best-effort audit
    }
    return report;
  },
});
