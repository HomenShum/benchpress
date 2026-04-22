# attrition-executor

Cloud Run service that runs the literal emitted Python scaffold
against a user prompt and streams real trace spans back to our
Convex webhook. Tier-2 of the live-run architecture
(docs/LIVE_RUN_AND_TRACE_ADR.md).

## Why

Tier 1 rendered scripted spans in the UI. The TS agent loop in
`convex/domains/daas/liveAgent.ts` runs a real Claude call from
Convex — useful but not "Python is running." This service closes
that gap: it imports the exact emitter modules the download path
uses, so the scaffold on the server equals the scaffold in the ZIP.

## Endpoints

- `GET /health`
- `POST /execute`

### POST /execute

Body:
```json
{
  "run_id": "abc-123",
  "lane": "orchestrator_worker",
  "user_prompt": "Order 30 units of SKU-442...",
  "session_slug": "demo-retail-ops",
  "byok_anthropic_key": "sk-ant-...",
  "byok_gemini_key": "AIza..."
}
```

Returns: `{ok, exit_code, parsed: {final_output, cost_usd}, stderr_tail}`.

Side effect: POSTs trace spans to `CONVEX_TRACE_URL` during execution.

## Local dev

```bash
pip install -r executor/requirements.txt
ANTHROPIC_API_KEY=... \
  CONVEX_TRACE_URL=https://joyous-walrus-428.convex.cloud/http/attritionTrace \
  python3 executor/main.py
```

## Deploy

```bash
gcloud builds submit --config=executor/cloudbuild.yaml .
```

Then set the Anthropic key via Secret Manager:

```bash
gcloud secrets create attrition-executor-anthropic \
  --replication-policy=automatic \
  --data-file=- < /path/to/anthropic.key
gcloud run services update attrition-executor \
  --region=us-central1 \
  --update-secrets=ANTHROPIC_API_KEY=attrition-executor-anthropic:latest
```

## Guardrails

- Isolated /tmp workspace per request, rmtree on completion
- subprocess.run timeout (default 60s)
- BYOK keys passed as env, never logged
- CONVEX_TRACE_URL baked into image; user can't redirect spans
- max-instances=5, scale-to-zero when idle
