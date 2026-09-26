# AI architecture

## Where AI is used
Only in the **Admissions Assistant** (AG-001, `06-agents/AG-001-admissions-assistant.md`). The
rank finder, college pages and all numbers are deterministic code (`packages/core`). The model
understands the question, calls tools, and explains the results in plain language.

## Why tools, not RAG (ADR-004)
The knowledge is structured tables of cutoffs. Retrieving text chunks would lose precision and
invite the model to do arithmetic. The model calls the same functions the app uses instead.

## Model strategy
| Item | Status |
|---|---|
| Provider and model | `DECISION REQUIRED` in Phase 7. Candidates: Claude (strong tool use and instruction following) and Groq-hosted open models (low cost and latency, already used in GUPO). Chosen by measured results on the eval set, not by assumption. |
| Required capabilities | Tool/function calling with JSON schemas; streaming; reliable refusal behaviour |
| Fallback | Second provider behind the same harness interface; on provider error the user gets a retryable error, never an unverified answer |
| Context window | Small needs: system prompt + profile + trimmed history + tool results. No long documents |
| Cost and latency | Measured per model in Phase 7; see `cost.md` |

## Harness responsibilities (in `apps/api`)
1. Authenticate; check entitlement and remaining usage budget.
2. Assemble context: versioned system prompt, the user's saved profile fields relevant to the
   question, the last N turns (`ASSUMPTION` N = 10).
3. Call the model with tool schemas.
4. For each tool call: check the tool is allow-listed, validate arguments against the schema,
   execute read-only, cap result size, return the result. Stop after a maximum number of tool
   calls per turn (`ASSUMPTION`: 5).
5. Grounding check: every number in the final answer must appear in that turn's tool results. On
   failure, retry once with a correction message, then return a safe fallback.
6. Stream the answer with citations.
7. Record telemetry and a usage event.
Timeouts, retries and error mapping follow `04-api/error-model.md`.

## Context rules
Include only what the question needs. Never include other users' data, raw PDFs or candidate
names (none exist in the DB). User text is treated as data, never as instructions to the harness.
