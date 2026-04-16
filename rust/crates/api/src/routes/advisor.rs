//! Advisor Mode analytics endpoints.
//!
//! Computes aggregate stats from advisor.* retention packets.
//! No new storage — reads from existing retention_packets in AppState.
//!
//! GET /api/advisor/stats     — Aggregate advisor mode statistics
//! GET /api/advisor/sessions  — Per-session advisor summaries
//! GET /api/advisor/decisions — Individual escalation decisions

use axum::{
    extract::State,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

// ── Model pricing (USD per million tokens) ─────────────────────────────────

const PRICING: &[(&str, f64, f64)] = &[
    ("claude-opus-4-6",   15.0,  75.0),
    ("claude-sonnet-4-6",  3.0,  15.0),
    ("claude-haiku-4-5",   0.8,   4.0),
    ("gpt-4o",             2.5,  10.0),
    ("gpt-4o-mini",        0.15,  0.6),
    ("gemini-3.1-flash-lite-preview", 0.075, 0.30),
    ("gemini-2.5-flash",   0.15,  0.60),
];

fn model_cost(model: &str, input_tokens: u64, output_tokens: u64) -> f64 {
    let (inp_rate, out_rate) = PRICING
        .iter()
        .find(|(name, _, _)| model.contains(name))
        .map(|(_, i, o)| (*i, *o))
        .unwrap_or((3.0, 15.0)); // default to Sonnet pricing
    (input_tokens as f64 / 1_000_000.0) * inp_rate
        + (output_tokens as f64 / 1_000_000.0) * out_rate
}

// ── Response types ──────────────────────────────────────────────────────────

#[derive(Serialize)]
struct AdvisorStats {
    total_sessions: usize,
    total_decisions: usize,
    total_pipeline_runs: usize,

    // Cost breakdown
    executor_total_cost_usd: f64,
    advisor_total_cost_usd: f64,
    combined_total_cost_usd: f64,
    advisor_cost_share_pct: f64,

    // Token breakdown
    executor_total_tokens: u64,
    advisor_total_tokens: u64,

    // Effectiveness
    escalation_rate_pct: f64,
    advisor_resolved_pct: f64,
    avg_user_corrections: f64,

    // Comparison
    estimated_opus_only_cost_usd: f64,
    savings_vs_opus_only_pct: f64,

    // Model usage
    models_seen: Vec<String>,

    // Per-model breakdown
    model_breakdown: Vec<ModelBreakdown>,
}

#[derive(Serialize)]
struct ModelBreakdown {
    model: String,
    calls: u64,
    total_tokens: u64,
    total_cost_usd: f64,
    avg_tokens_per_call: u64,
    role: String, // "executor" | "advisor" | "pipeline"
}

#[derive(Serialize)]
struct AdvisorSession {
    session_id: String,
    subject: String,
    executor_model: String,
    advisor_model: String,
    executor_tokens: u64,
    executor_cost_usd: f64,
    advisor_tokens: u64,
    advisor_cost_usd: f64,
    escalation_count: u64,
    task_completed: bool,
    user_corrections: u64,
    timestamp: String,
}

#[derive(Serialize)]
struct AdvisorDecision {
    decision_id: String,
    session_id: String,
    trigger: String,
    advisor_model: String,
    advisor_tokens: u64,
    advisor_cost_usd: f64,
    advice_type: String,
    advice_summary: String,
    was_applied: bool,
    timestamp: String,
}

#[derive(Serialize)]
struct StatsResponse {
    stats: AdvisorStats,
    message: String,
}

#[derive(Serialize)]
struct SessionsResponse {
    sessions: Vec<AdvisorSession>,
}

#[derive(Serialize)]
struct DecisionsResponse {
    decisions: Vec<AdvisorDecision>,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn extract_str(data: &serde_json::Value, key: &str) -> String {
    data.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn extract_u64(data: &serde_json::Value, key: &str) -> u64 {
    data.get(key)
        .and_then(|v| v.as_u64())
        .unwrap_or(0)
}

fn extract_f64(data: &serde_json::Value, key: &str) -> f64 {
    data.get(key)
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
}

fn extract_bool(data: &serde_json::Value, key: &str) -> bool {
    data.get(key)
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

fn nested_str(data: &serde_json::Value, outer: &str, inner: &str) -> String {
    data.get(outer)
        .and_then(|v| v.get(inner))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn nested_u64(data: &serde_json::Value, outer: &str, inner: &str) -> u64 {
    data.get(outer)
        .and_then(|v| v.get(inner))
        .and_then(|v| v.as_u64())
        .unwrap_or(0)
}

fn nested_f64(data: &serde_json::Value, outer: &str, inner: &str) -> f64 {
    data.get(outer)
        .and_then(|v| v.get(inner))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
}

// ── Handlers ────────────────────────────────────────────────────────────────

async fn stats(
    State(state): State<Arc<AppState>>,
) -> Json<StatsResponse> {
    state.increment_requests();

    let packets = state.retention_packets.lock().await;

    // Separate packet types
    let decisions: Vec<_> = packets
        .iter()
        .filter(|p| p.packet_type == "advisor.decision")
        .collect();
    let sessions: Vec<_> = packets
        .iter()
        .filter(|p| p.packet_type == "advisor.session")
        .collect();
    let pipeline_runs: Vec<_> = packets
        .iter()
        .filter(|p| p.packet_type == "delta.pipeline_run")
        .collect();

    // Aggregate from advisor.session packets
    let mut executor_cost = 0.0_f64;
    let mut advisor_cost = 0.0_f64;
    let mut executor_tokens = 0_u64;
    let mut advisor_tokens = 0_u64;
    let mut total_escalations = 0_u64;
    let mut total_calls = 0_u64;
    let mut resolved_count = 0_u64;
    let mut correction_sum = 0_u64;
    let mut models_set = std::collections::HashSet::new();
    let mut model_stats: std::collections::HashMap<String, (u64, u64, f64, String)> =
        std::collections::HashMap::new();

    for sess in &sessions {
        let d = &sess.data;
        let ex_cost = nested_f64(d, "executor_stats", "total_cost_usd");
        let adv_cost = nested_f64(d, "advisor_stats", "total_cost_usd");
        let ex_tokens = nested_u64(d, "executor_stats", "total_tokens");
        let adv_tokens = nested_u64(d, "advisor_stats", "total_tokens");
        let ex_calls = nested_u64(d, "executor_stats", "calls");
        let adv_calls = nested_u64(d, "advisor_stats", "calls");
        let corrections = nested_u64(d, "combined", "user_corrections");

        executor_cost += ex_cost;
        advisor_cost += adv_cost;
        executor_tokens += ex_tokens;
        advisor_tokens += adv_tokens;
        total_escalations += adv_calls;
        total_calls += ex_calls + adv_calls;
        correction_sum += corrections;

        let ex_model = extract_str(d, "executor_model");
        let adv_model = extract_str(d, "advisor_model");
        if !ex_model.is_empty() {
            models_set.insert(ex_model.clone());
            let entry = model_stats.entry(ex_model).or_insert((0, 0, 0.0, "executor".into()));
            entry.0 += ex_calls;
            entry.1 += ex_tokens;
            entry.2 += ex_cost;
        }
        if !adv_model.is_empty() {
            models_set.insert(adv_model.clone());
            let entry = model_stats.entry(adv_model).or_insert((0, 0, 0.0, "advisor".into()));
            entry.0 += adv_calls;
            entry.1 += adv_tokens;
            entry.2 += adv_cost;
        }
    }

    // Also aggregate from pipeline_run packets (real Gemini costs)
    let mut pipeline_cost = 0.0_f64;
    let mut pipeline_tokens = 0_u64;
    for run in &pipeline_runs {
        let d = &run.data;
        if let Some(rc) = d.get("realCost") {
            pipeline_cost += extract_f64(rc, "totalCostUsd");
        }
        if let Some(tu) = d.get("tokenUsage") {
            let total = extract_u64(tu, "totalTokens");
            pipeline_tokens += total;
            let m = extract_str(tu, "model");
            if !m.is_empty() {
                models_set.insert(m.clone());
                let entry = model_stats.entry(m).or_insert((0, 0, 0.0, "pipeline".into()));
                entry.0 += 1;
                entry.1 += total;
                entry.2 += extract_f64(rc_for(d), "totalCostUsd");
            }
        }
    }

    // Count resolved decisions
    for dec in &decisions {
        let d = &dec.data;
        if nested_str(d, "outcome", "").is_empty() {
            if extract_bool(d.get("outcome").unwrap_or(&serde_json::Value::Null), "task_completed") {
                resolved_count += 1;
            }
        }
    }

    let combined = executor_cost + advisor_cost + pipeline_cost;
    let all_tokens = executor_tokens + advisor_tokens + pipeline_tokens;

    // Estimate opus-only cost: all tokens at Opus pricing
    let estimated_opus = (all_tokens as f64 / 1_000_000.0) * 45.0; // blended ~$45/M

    let model_breakdown: Vec<ModelBreakdown> = model_stats
        .into_iter()
        .map(|(model, (calls, tokens, cost, role))| ModelBreakdown {
            model,
            calls,
            total_tokens: tokens,
            total_cost_usd: (cost * 1_000_000.0).round() / 1_000_000.0,
            avg_tokens_per_call: if calls > 0 { tokens / calls } else { 0 },
            role,
        })
        .collect();

    let stats = AdvisorStats {
        total_sessions: sessions.len(),
        total_decisions: decisions.len(),
        total_pipeline_runs: pipeline_runs.len(),
        executor_total_cost_usd: (executor_cost * 1_000_000.0).round() / 1_000_000.0,
        advisor_total_cost_usd: (advisor_cost * 1_000_000.0).round() / 1_000_000.0,
        combined_total_cost_usd: (combined * 1_000_000.0).round() / 1_000_000.0,
        advisor_cost_share_pct: if combined > 0.0 {
            ((advisor_cost / combined) * 1000.0).round() / 10.0
        } else {
            0.0
        },
        executor_total_tokens: executor_tokens,
        advisor_total_tokens: advisor_tokens,
        escalation_rate_pct: if total_calls > 0 {
            ((total_escalations as f64 / total_calls as f64) * 1000.0).round() / 10.0
        } else {
            0.0
        },
        advisor_resolved_pct: if decisions.len() > 0 {
            ((resolved_count as f64 / decisions.len() as f64) * 1000.0).round() / 10.0
        } else {
            0.0
        },
        avg_user_corrections: if sessions.len() > 0 {
            ((correction_sum as f64 / sessions.len() as f64) * 10.0).round() / 10.0
        } else {
            0.0
        },
        estimated_opus_only_cost_usd: (estimated_opus * 100.0).round() / 100.0,
        savings_vs_opus_only_pct: if estimated_opus > 0.0 {
            (((estimated_opus - combined) / estimated_opus) * 1000.0).round() / 10.0
        } else {
            0.0
        },
        models_seen: models_set.into_iter().collect(),
        model_breakdown,
    };

    let msg = if sessions.is_empty() && decisions.is_empty() && pipeline_runs.is_empty() {
        "No advisor data yet. Push advisor.session or advisor.decision packets to see stats.".into()
    } else {
        format!(
            "{} sessions, {} decisions, {} pipeline runs. All costs measured from real API token counts.",
            sessions.len(),
            decisions.len(),
            pipeline_runs.len(),
        )
    };

    Json(StatsResponse { stats, message: msg })
}

/// Helper to safely get realCost from packet data
fn rc_for(data: &serde_json::Value) -> &serde_json::Value {
    data.get("realCost").unwrap_or(&serde_json::Value::Null)
}

async fn list_sessions(
    State(state): State<Arc<AppState>>,
) -> Json<SessionsResponse> {
    state.increment_requests();

    let packets = state.retention_packets.lock().await;
    let sessions: Vec<AdvisorSession> = packets
        .iter()
        .filter(|p| p.packet_type == "advisor.session")
        .map(|p| {
            let d = &p.data;
            AdvisorSession {
                session_id: extract_str(d, "session_id"),
                subject: p.subject.clone(),
                executor_model: extract_str(d, "executor_model"),
                advisor_model: extract_str(d, "advisor_model"),
                executor_tokens: nested_u64(d, "executor_stats", "total_tokens"),
                executor_cost_usd: nested_f64(d, "executor_stats", "total_cost_usd"),
                advisor_tokens: nested_u64(d, "advisor_stats", "total_tokens"),
                advisor_cost_usd: nested_f64(d, "advisor_stats", "total_cost_usd"),
                escalation_count: nested_u64(d, "advisor_stats", "calls"),
                task_completed: nested_str(d, "combined", "task_completed")
                    .parse::<bool>()
                    .unwrap_or(extract_bool(
                        d.get("combined").unwrap_or(&serde_json::Value::Null),
                        "task_completed",
                    )),
                user_corrections: nested_u64(d, "combined", "user_corrections"),
                timestamp: p.timestamp.clone(),
            }
        })
        .collect();

    Json(SessionsResponse { sessions })
}

async fn list_decisions(
    State(state): State<Arc<AppState>>,
) -> Json<DecisionsResponse> {
    state.increment_requests();

    let packets = state.retention_packets.lock().await;
    let decisions: Vec<AdvisorDecision> = packets
        .iter()
        .filter(|p| p.packet_type == "advisor.decision")
        .map(|p| {
            let d = &p.data;
            AdvisorDecision {
                decision_id: extract_str(d, "decision_id"),
                session_id: extract_str(d, "session_id"),
                trigger: extract_str(d, "trigger"),
                advisor_model: nested_str(d, "advisor", "model"),
                advisor_tokens: nested_u64(d, "advisor", "total_tokens"),
                advisor_cost_usd: nested_f64(d, "advisor", "cost_usd"),
                advice_type: nested_str(d, "advisor", "advice_type"),
                advice_summary: nested_str(d, "advisor", "advice_summary"),
                was_applied: extract_bool(
                    d.get("outcome").unwrap_or(&serde_json::Value::Null),
                    "executor_applied",
                ),
                timestamp: extract_str(d, "timestamp"),
            }
        })
        .collect();

    Json(DecisionsResponse { decisions })
}

// ── Route registration ───────────────────────────────────────────────────────

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/stats", get(stats))
        .route("/sessions", get(list_sessions))
        .route("/decisions", get(list_decisions))
}
