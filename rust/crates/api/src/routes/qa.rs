use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use crate::state::AppState;

// ── Request/Response types ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct QaCheckRequest {
    pub url: String,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default)]
    pub include_screenshots: bool,
}

fn default_timeout() -> u64 {
    30_000
}

#[derive(Serialize)]
pub struct QaCheckResponse {
    pub id: String,
    pub url: String,
    pub score: u8,
    pub issues_count: usize,
    pub duration_ms: u64,
    pub status: &'static str,
}

#[derive(Deserialize)]
pub struct SitemapRequest {
    pub url: String,
    #[serde(default = "default_max_depth")]
    pub max_depth: u8,
    #[serde(default = "default_max_pages")]
    pub max_pages: usize,
}

fn default_max_depth() -> u8 {
    3
}

fn default_max_pages() -> usize {
    50
}

#[derive(Serialize)]
pub struct SitemapResponse {
    pub root_url: String,
    pub total_pages: usize,
    pub duration_ms: u64,
}

#[derive(Deserialize)]
pub struct UxAuditRequest {
    pub url: String,
}

#[derive(Serialize)]
pub struct UxAuditResponse {
    pub url: String,
    pub score: u8,
    pub rules_checked: usize,
    pub rules_passed: usize,
    pub duration_ms: u64,
}

#[derive(Deserialize)]
pub struct DiffCrawlRequest {
    pub url: String,
    pub baseline_id: Option<String>,
}

#[derive(Serialize)]
pub struct DiffCrawlResponse {
    pub url: String,
    pub changes_detected: usize,
    pub duration_ms: u64,
}

#[derive(Serialize)]
struct ApiError {
    error: String,
    status: u16,
}

// ── Handlers ────────────────────────────────────────────────────────────────

async fn qa_check(
    State(state): State<Arc<AppState>>,
    Json(req): Json<QaCheckRequest>,
) -> Result<Json<QaCheckResponse>, impl IntoResponse> {
    state.increment_requests();
    let start = std::time::Instant::now();

    let result = nodebench_qa_engine::qa::run_qa_check(&req.url, req.timeout_ms).await;

    match result {
        Ok(r) => Ok(Json(QaCheckResponse {
            id: Uuid::new_v4().to_string(),
            url: req.url,
            score: r.score.overall,
            issues_count: r.issues.len(),
            duration_ms: start.elapsed().as_millis() as u64,
            status: "completed",
        })),
        Err(e) => Err((
            StatusCode::BAD_GATEWAY,
            Json(ApiError { error: e.to_string(), status: 502 }),
        )),
    }
}

async fn sitemap(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SitemapRequest>,
) -> Result<Json<SitemapResponse>, impl IntoResponse> {
    state.increment_requests();
    let start = std::time::Instant::now();

    let result = nodebench_qa_engine::crawl::crawl_sitemap(&req.url, req.max_depth, req.max_pages).await;

    match result {
        Ok(r) => Ok(Json(SitemapResponse {
            root_url: req.url,
            total_pages: r.total_pages,
            duration_ms: start.elapsed().as_millis() as u64,
        })),
        Err(e) => Err((
            StatusCode::BAD_GATEWAY,
            Json(ApiError { error: e.to_string(), status: 502 }),
        )),
    }
}

async fn ux_audit(
    State(state): State<Arc<AppState>>,
    Json(req): Json<UxAuditRequest>,
) -> Result<Json<UxAuditResponse>, impl IntoResponse> {
    state.increment_requests();
    let start = std::time::Instant::now();

    let result = nodebench_qa_engine::audit::run_ux_audit(&req.url).await;

    match result {
        Ok(r) => Ok(Json(UxAuditResponse {
            url: req.url,
            score: r.score,
            rules_checked: r.rules_checked,
            rules_passed: r.rules_passed,
            duration_ms: start.elapsed().as_millis() as u64,
        })),
        Err(e) => Err((
            StatusCode::BAD_GATEWAY,
            Json(ApiError { error: e.to_string(), status: 502 }),
        )),
    }
}

async fn diff_crawl(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DiffCrawlRequest>,
) -> Result<Json<DiffCrawlResponse>, impl IntoResponse> {
    state.increment_requests();
    let start = std::time::Instant::now();

    let result = nodebench_qa_engine::diff::run_diff_crawl(&req.url, req.baseline_id.as_deref()).await;

    match result {
        Ok(r) => Ok(Json(DiffCrawlResponse {
            url: req.url,
            changes_detected: r.diffs.len(),
            duration_ms: start.elapsed().as_millis() as u64,
        })),
        Err(e) => Err((
            StatusCode::BAD_GATEWAY,
            Json(ApiError { error: e.to_string(), status: 502 }),
        )),
    }
}

// ── Router ──────────────────────────────────────────────────────────────────

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/check", post(qa_check))
        .route("/sitemap", post(sitemap))
        .route("/ux-audit", post(ux_audit))
        .route("/diff-crawl", post(diff_crawl))
}
