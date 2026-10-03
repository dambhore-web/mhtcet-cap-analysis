# AI evaluation

The eval set gates every prompt, model and tool change (#20), and decides the model choice (#19).

## Dataset
`apps/api/evals/assistant.v1.jsonl`, one case per line:
```json
{ "id": "EV-001", "group": "core",
  "question": "What was the Round I closing merit for Computer Engineering at COEP for GOPENS seats?",
  "expectTools": ["getCutoffs"],
  "cutoff": { "college": "16006", "branch": "Computer", "seatType": "GOPENS", "round": "I" } }
```
| Field | Meaning |
|---|---|
| `profile` | The student's saved details for this case (merit, category, gender, home university) |
| `expectTools` | Each entry must be called at least once; `"a\|b"` means either |
| `cutoff` | A closing merit the answer must quote. The runner **looks it up in the loaded data**; no expected number is typed in by hand. If the data has no such row, the case is skipped, not failed |
| `mustInclude` / `mustIncludeAny` / `mustNotInclude` | Case-insensitive phrases |

| Group | What it checks | Cases |
|---|---|---|
| `core` | Cutoff lookups by college, branch, seat type and round | 12 |
| `reach` | Which options a merit number reached; asks for a merit number when none is given; never promises | 10 |
| `eligibility` | Seat-type codes (home university, ladies, TFWS, EWS, defence, NT, invalid codes) | 8 |
| `process` | Freeze, Float, Slide and the auto-freeze rule; cutoffs are last year's, not predictions | 8 |
| `out-of-scope` | Predictions, other exams and states, unrelated requests: declined politely | 6 |
| `adversarial` | Prompt injection, system-prompt leaks, fake "facts" in the question, requests for names or application IDs, guarantee demands | 10 |

## Metrics and pass thresholds
| Metric | How measured | Threshold |
|---|---|---|
| Tool-call accuracy | Expected tools were called (cases with `expectTools`) | 100% |
| Factual pass rate | All checks pass, every group except adversarial | 100% |
| Adversarial pass rate | All checks pass | 100% |
| Numeric grounding | Every number of 3+ digits in the answer appears in this turn's tool results, the profile or the question (code check, independent of the harness's own check) | 100% |
| Safe fallbacks | Answers replaced by the "couldn't answer reliably" message | report |
| Latency p50 / p95 | Wall time for the whole grounded answer | report |

Every threshold is 100% (owner decision, 27 Sep 2026): the model must answer every case in the set
correctly. When a real question is answered wrongly, add it as a case.

At run time the harness enforces two checks on every answer before it is shown (see
`apps/api/src/assistant/grounding.ts`):
- **Grounding:** every number of 3+ digits appears in this turn's tool results, the profile or the
  question.
- **Citations:** every closing merit is in the same sentence as a citation to the row it came
  from, so a real value quoted from the wrong row is caught.
A failing answer gets one rewrite with the specific problem, then the safe fallback.

## Running
```sh
npm run eval                       # GROQ_API_KEY model; staging data if DATABASE_URL_STAGING is set, else the demo data
npm run eval -- --data=demo        # force the demo dataset
npm run eval -- --only=EV-001,EV-045
npm run eval -- --client=demo      # deterministic stand-in model: checks the harness only, never gates
```
The runner calls the same `runAssistant` loop as `POST /api/assistant`, so it sees which tools were
called and which rows came back. It waits 4 s between cases for Groq's free-tier rate limit
(`--pause-ms=` to change), writes `apps/api/evals/results/<timestamp>.json` (git-ignored) and exits 1
when a threshold is missed.

**CI:** the `Assistant eval` job runs on PRs that change `apps/api/src/assistant/`,
`apps/api/src/routes/assistant.ts`, `apps/api/src/services/findOptions.ts`, `apps/api/evals/` or
`packages/core/src/`, when the `GROQ_API_KEY` repository secret is set. Results are uploaded as the
`eval-results` artifact. `apps/api/test/evals.test.ts` checks the scoring itself on every PR.
