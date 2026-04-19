# Distillation-as-a-Service — Root-Cause First Principles Design

## The problem V3 exposed

V3 proved: injecting a skill TEMPLATE into a cheap model's prompt does not close the capability gap. Skills transferred ~13pp of reasoning but (a) still trailed strong by 27pp on hard questions, (b) prompt overhead ate the cost savings.

**Root cause**: skills-as-text-injection compresses only the REASONING CHAIN. It does not replicate what makes Pro valuable:
- Multi-step tool dispatch with state management
- Sub-agent handoffs with scoped context
- Verification loops
- Error recovery

A checklist can't fix missing architecture. The answer is not "inject a skill" — it is "generate the full runtime."

## The vision (what we're actually building)

Capture a Claude Code workflow (Sonnet + Opus advisor, expensive) → distill the entire workflow architecture (agents, tools, handoffs, state) → generate a runtime scaffold using any agent SDK (Gemini/OpenAI/Anthropic/LangChain) → replay the workflow with cheap models on attrition.sh → measure quality + cost vs original.

The scaffold IS the skill. The skill is not prompt text — it is a full orchestrator-worker graph with tool dispatch, mocked or live connectors, and visible trace.

Think: **Chef for agent runtimes, not apps**.

## Runtime Diagram

```
USER CLAUDE CODE SESSION                          <-- expensive run (source of truth)
(Sonnet executor + Opus advisor, real tools)
   |
   |  attrition MCP plugin / /capture hook / WebSocket
   |  streams: messages, tool calls, usage tokens,
   |           file edits, advisor consultations
   v
+--------------------------------------------------+
| TRACE INGEST                                     |
|  - CanonicalTrace{steps[], tools[], handoffs[],  |
|                   stateDiff[], costUsd, model}   |
|  - Optional: user repo URL + CLAUDE.md          |
|  - Privacy: secrets scrubbed at ingest boundary  |
+--------------------------------------------------+
   |
   v
+--------------------------------------------------+
| DISTILLER  (one expensive call: Pro or Opus)     |
| Reads the CanonicalTrace and extracts:           |
|   - Sub-agent boundaries (planner vs worker)     |
|   - Tool-call DAG per sub-agent                  |
|   - Handoff points + payload shapes              |
|   - State machine (what changes between turns)   |
|   - Success criteria (derived from final output) |
|   - Domain rules (hardcoded guardrails)          |
| Emits: WorkflowSpec (schema-validated JSON)      |
+--------------------------------------------------+
   |
   +-----------> validates WorkflowSpec executable?
   |             retries distillation with feedback
   |
   v
+--------------------------------------------------+
| SCAFFOLD GENERATOR                               |
| Picks one target SDK per user preference:        |
|   - OpenAI Agents SDK    (@openai/agents)        |
|   - Anthropic Agent SDK  (claude-agent-sdk)      |
|   - Google Gemini Agent SDK (google-genai)       |
|   - LangChain  (langchain, langgraph)            |
|                                                  |
| Emits codegen bundle:                            |
|   orchestrator.ts  (cheap model, plan+dispatch)  |
|   workers/*.ts     (cheap model per role)        |
|   tools.ts         (mock | live | hybrid)        |
|   state.ts         (Convex mutations/queries)    |
|   replay.ts        (runs against test cases)     |
+--------------------------------------------------+
   |
   v
+--------------------------------------------------+
| CONNECTOR RESOLVER                               |
|   MOCK     JSON fixtures in /mock/*.json         |
|   LIVE     user provides API endpoint + auth    |
|   HYBRID   mocks for read, live for write        |
|   VAULT    secrets encrypted server-side only    |
+--------------------------------------------------+
   |
   v
+--------------------------------------------------+
| RUNTIME HARNESS  (executes on attrition.sh      |
|                   in a sandboxed worker)         |
+--------------------------------------------------+
   |
   v
    +---------+    +---------+    +---------+    +---------+
    | orch    |--->| workerA |    | workerB |    | workerC |
    | Flash   |    | Haiku   |    | Haiku   |    | Haiku   |
    +---------+    +---------+    +---------+    +---------+
         |              |              |              |
         +--- tool calls + handoffs (scoped context) -+
         |
         v
+--------------------------------------------------+
| REPLAY JUDGE                                     |
|   - output similarity vs original                |
|   - cost delta (real tokens, measured)           |
|   - tool-call parity (same tools in same order?) |
|   - quality via deterministic checks             |
+--------------------------------------------------+
   |
   v
+--------------------------------------------------+
| PUBLISH                                          |
|   - export zip (runnable code + tests)           |
|   - live trace URL: attrition.sh/runs/:id        |
|   - cost delta card: before vs after             |
|   - shareable replay for manager screenshot      |
+--------------------------------------------------+
```

## Component design (first principles)

### 1. Trace ingestion — frictionless

**Problem**: users won't paste traces. They won't configure webhooks.

**Solution**: one-command MCP plugin that attaches to any Claude Code session:

```bash
npx @attrition/capture install
# adds to ~/.claude/settings.json:
#   "hooks": {"PostToolUse": ["npx @attrition/capture send"]}
# adds MCP server that exposes /distill command
```

After install, the plugin:
- Streams every tool call to attrition backend (same schema as FloorAI integration we proved)
- Buffers session locally, batch-flushes on Stop event
- User types `/distill` in Claude Code → opens attrition.sh/distill/:sessionId in browser

**Alternative paths** (for non-Claude-Code users):
- Paste a JSONL transcript
- Connect OpenAI/Anthropic API proxy
- Upload a LangSmith trace export

### 2. Canonical trace schema

One shape regardless of source. Enables cross-SDK distillation.

```typescript
type CanonicalTrace = {
  sessionId: string;
  sourceModel: string;  // "claude-sonnet-4-6" | "gpt-4o" | ...
  advisorModel?: string;
  steps: TraceStep[];
  tools: ToolInvocation[];
  handoffs: Handoff[];
  stateDiff: StateDiff[];
  totalCostUsd: number;
  totalTokens: number;
  durationMs: number;
  repoContext?: { url: string; claudeMd?: string };
};
```

### 3. Distiller — WorkflowSpec extraction

The distiller is the only expensive call in the pipeline. Input: CanonicalTrace. Output: validated WorkflowSpec.

```typescript
type WorkflowSpec = {
  orchestrator: {
    model: string;       // cheap model target
    systemPrompt: string;
    planPrompt: string;
  };
  workers: Worker[];
  tools: ToolDef[];
  handoffs: HandoffRule[];
  successCriteria: string[];
  domainRules: string[];  // hard guardrails
};
```

Validation: try to execute WorkflowSpec against a dry-run harness. If it fails, re-distill with the failure as feedback.

### 4. Scaffold generator — SDK-targeted codegen

One template per SDK. Same WorkflowSpec in, SDK-idiomatic code out.

Deterministic: same WorkflowSpec produces byte-identical code every time.

### 5. Runtime harness — Chef-style visible execution

Borrowed from Convex Chef: sandboxed worker executes the generated scaffold, streams trace to a live UI.

UI: three panes.
- **Left**: generated code editor (read-only initially, editable later)
- **Center**: live execution graph (orchestrator node lights up, workers light up as dispatched, tool calls animate)
- **Right**: input panel (mock JSON OR live API config)

### 6. Connector resolver — mock or live

Two modes:
- **Mock-first** (default): JSON fixtures generated from captured tool responses. User runs replay instantly with no external deps.
- **Live**: user pastes endpoint URL + auth. Stored encrypted. Used only when running live replays.
- **Hybrid**: mocks for read-only tools (get_*, search_*), live for write tools (create_*, send_*).

### 7. Replay judge — the proof

Every replay emits:
- **Output similarity**: BERTScore vs original response
- **Cost delta**: real token costs measured from replay
- **Tool-call parity**: did the cheap runtime call the same tools in the same order?
- **Quality gate**: deterministic checks (e.g., required refs cited, schema validates)

If replay passes, publish. If not, diagnose which step diverged and offer re-distillation.

## Why this is defensible

1. **Full pipeline, not prompts**: competitors (LiteLLM, Claudetop, AgentOps) do measurement. Nobody generates runnable runtime scaffolds from traces.
2. **SDK-agnostic**: user picks their target framework. We don't lock in.
3. **Visible + shareable**: like Chef, the UX is a live trace URL. Screenshot-worthy. Built-in virality.
4. **Measurement is truth**: cost + quality are both MEASURED from real API usage, never estimated.

## Phased build plan

| Phase | Scope | Ship criterion |
|-------|-------|----------------|
| P1 (1w) | MCP capture plugin + CanonicalTrace ingest | FloorAI run captured end-to-end |
| P2 (1w) | Distiller + WorkflowSpec + validator | 5 distinct workflows distilled cleanly |
| P3 (2w) | Scaffold generator (Gemini SDK first) | Generated code runs, matches original tools |
| P4 (2w) | Runtime harness UI on attrition.sh | Live trace visible, editable inputs |
| P5 (1w) | Replay judge + publish flow | Cost delta card + zip export working |
| P6 (ongoing) | Add OpenAI/Anthropic/LangChain generators | Each SDK passes replay parity tests |

**Kill criterion after P3**: if <3 of 5 test workflows produce working scaffolds that replay correctly, the distillation engine doesn't generalize → fold back to cost-routing product.

## What lives on attrition.sh after this

- **/distill/:sessionId** — ingest a trace, run distillation, show generated scaffold
- **/runs/:id** — live trace of a replay (like Chef's build view)
- **/workflows** — library of distilled scaffolds (user's + community's)
- **/cost-delta** — before/after card per workflow, shareable URL

Every page is measured, evidence-backed, and shareable.
