# AG-001 Admissions Assistant

| Field | Value |
|---|---|
| Agent ID | AG-001 |
| Name | Admissions Assistant |
| Purpose | Answer candidates' CAP cutoff questions in plain language, grounded in the data |
| Why an agent | Free-text questions need interpreting (category, gender, flags, filters), may need several lookups, and need explaining |
| Responsibilities | Understand the question · ask for missing essentials (e.g. category) · call tools · explain results with citations · refuse out-of-scope or unsafe requests |
| Inputs | User message; saved profile (optional); conversation history (trimmed) |
| Outputs | Answer text + citations (college, branch, seat type, round, year) |
| Allowed tools | `findOptions`, `getCutoffs`, `explainSeatType`, `searchColleges` (see `tools-registry.md`) |
| Memory | Conversation only. The saved profile is account data the user controls |
| Decision authority | Read and explain only. No writes, no payments, no external actions |
| Constraints | Numbers only from tool results · no admission guarantees · CAP engineering scope only |
| Guardrails | `05-ai/guardrails.md` |
| Failure handling | Tool error → retry once, then tell the user what failed · grounding failure → one corrective retry, then safe fallback · provider error → retryable error |
| Escalation | Suggests official CET Cell sources for rule questions it can't answer from data |
| Evaluation | `05-ai/evaluation.md` thresholds |
| Cost limits | Per-user allowance by plan (`05-ai/cost.md`); max tool calls and output tokens per turn |
| Latency target | First token < 3 s p95 (`ASSUMPTION`) |
| Model | `DECISION REQUIRED` (Phase 7) |
| Prompt | `apps/api/prompts/assistant.system.v<N>.md` |

## Execution policy
All of AG-001's actions are READ/ANALYZE and run automatically. It has no WRITE, EXECUTE or
DESTRUCTIVE actions.
