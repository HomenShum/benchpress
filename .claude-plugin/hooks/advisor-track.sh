#!/usr/bin/env bash
# advisor-track.sh — Track advisor-mode subagent invocations
#
# Triggered by SubagentStop hook. Detects when an Opus advisor subagent
# completes and pushes an advisor.decision packet to the attrition backend.
#
# Environment:
#   HOOK_EVENT      — "SubagentStop"
#   HOOK_MODEL      — model used by the subagent (e.g. "claude-opus-4-6")
#   HOOK_TOKENS_IN  — input tokens consumed
#   HOOK_TOKENS_OUT — output tokens consumed
#   HOOK_DURATION   — duration in ms
#   HOOK_TASK       — task description

set -euo pipefail

ATTRITION_BACKEND="${ATTRITION_URL:-https://attrition-7xtb75zi5q-uc.a.run.app}"
SESSION_ID="${ATTRITION_SESSION_ID:-sess_$(date +%s)}"

# Only track if it looks like an advisor call (Opus model)
MODEL="${HOOK_MODEL:-unknown}"
case "$MODEL" in
  *opus*|*Opus*) ;;
  *) exit 0 ;; # Not an advisor call, skip
esac

INPUT_TOKENS="${HOOK_TOKENS_IN:-0}"
OUTPUT_TOKENS="${HOOK_TOKENS_OUT:-0}"
DURATION_MS="${HOOK_DURATION:-0}"
TASK="${HOOK_TASK:-advisor consultation}"

# Compute cost (Opus: $15/M input, $75/M output)
COST=$(python3 -c "
inp = $INPUT_TOKENS / 1_000_000 * 15.0
out = $OUTPUT_TOKENS / 1_000_000 * 75.0
print(f'{inp + out:.8f}')
" 2>/dev/null || echo "0")

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Push advisor.decision packet
curl -s -X POST "${ATTRITION_BACKEND}/api/retention/push-packet" \
  -H "Content-Type: application/json" \
  --max-time 5 \
  -d "{
    \"type\": \"advisor.decision\",
    \"subject\": \"Subagent advisor: ${TASK:0:80}\",
    \"summary\": \"${MODEL} - ${INPUT_TOKENS} in, ${OUTPUT_TOKENS} out - \$${COST}\",
    \"data\": {
      \"session_id\": \"${SESSION_ID}\",
      \"decision_id\": \"dec_$(date +%s%N | cut -c1-13)\",
      \"timestamp\": \"${TIMESTAMP}\",
      \"trigger\": \"subagent_invoked\",
      \"advisor\": {
        \"model\": \"${MODEL}\",
        \"input_tokens\": ${INPUT_TOKENS},
        \"output_tokens\": ${OUTPUT_TOKENS},
        \"total_tokens\": $((INPUT_TOKENS + OUTPUT_TOKENS)),
        \"cost_usd\": ${COST},
        \"latency_ms\": ${DURATION_MS},
        \"advice_type\": \"subagent\",
        \"advice_summary\": \"${TASK:0:200}\"
      },
      \"outcome\": {
        \"executor_applied\": true,
        \"task_completed\": false
      }
    }
  }" > /dev/null 2>&1 || true

echo '{"continue": true}'
