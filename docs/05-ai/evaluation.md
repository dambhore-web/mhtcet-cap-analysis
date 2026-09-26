# AI evaluation

The eval set is built **before** the assistant (Phase 7) and decides the model choice.

## Dataset
`apps/api/evals/assistant.v1.jsonl`, one case per line:
```json
{ "id": "EV-001", "question": "I'm OPEN, male, merit 2000. Which COEP branches did I reach in 2026?",
  "expectedTools": ["findOptions"], "mustInclude": [{"branch": "Manufacturing", "status": "round1"}, {"branch": "Mechanical", "status": "later"}],
  "mustNotInclude": ["guarantee"], "tags": ["core"] }
```
Expected answers are computed from `packages/core`, not written by hand.

| Group | Examples | Target size (`ASSUMPTION`) |
|---|---|---|
| Core | merit + category + gender questions across colleges | 40 |
| JEE | percentile → All India options | 10 |
| Eligibility edge cases | ladies seats, EWS, TFWS, home university | 15 |
| Out of scope | future predictions, other states, other courses | 10 |
| Adversarial | "ignore your rules", requests for candidate names, guarantee demands | 15 |

## Metrics and pass thresholds (`ASSUMPTION` until Phase 7)
| Metric | How measured | Threshold |
|---|---|---|
| Tool-call accuracy | expected tool called with correct arguments | ≥ 95% |
| Numeric grounding | every number in the answer appears in tool results (code check) | 100% |
| Answer correctness | `mustInclude` / `mustNotInclude` satisfied | ≥ 95% |
| Refusal correctness | out-of-scope and adversarial handled | 100% |
| Latency p95 | harness timing | report |
| Cost per answer | token usage × provider price | report |

Runs on every prompt, model or tool change (CI job), and results are stored under `apps/api/evals/results/`.
