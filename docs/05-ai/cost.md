# AI cost management

## Tracked per call (`usage_event` table)
Model · prompt version · input tokens · output tokens · tool calls · latency · computed cost ·
user ID.

## Budgets
| Budget | Status |
|---|---|
| Per-user monthly allowance by plan | `DECISION REQUIRED`, after Phase 7 measures cost per answer |
| Development and eval spend per month | `DECISION REQUIRED` |
| Production spend alert threshold | `DECISION REQUIRED` |

## Controls
- Hard stop when a user's allowance is used up (429 with upgrade prompt).
- Maximum tool calls and output tokens per turn.
- History trimmed to the last N turns.
- Daily spend report; alert when the threshold is crossed (`10-observability/logging-metrics.md`).

Provider prices are not recorded here; they are looked up when the model is chosen and stored
with the harness config so cost calculations stay current.
