# API contracts

Status: draft for Phase 6. An OpenAPI file will replace this table once the framework is chosen.
All routes are under `/api`, JSON in and out, request bodies schema-validated, errors per
`error-model.md`.

Implemented (apps/api, Hono). Auth and entitlements arrive with #15/#21; today every route is public.

JSON responses of 1 KB or more are gzipped when the request sends `Accept-Encoding: gzip`
(browsers always do). The assistant's event stream is never compressed (#27).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/meta` | What data is loaded: counts, lists × rounds with source files, fee and district coverage, recent loads (#114) |
| GET | `/api/colleges?q=&university=&district=&type=&limit=` | College search; response also lists the `districts` and `collegeTypes` present |
| GET | `/api/colleges/:code/cutoffs?year=` | Every cutoff row for a college, each with `source` (PDF) and `sourcePage`; the college's HU, district, type, intake |
| GET | `/api/cutoffs/open-latest` | Every branch's general open, state-level (GOPENS) closing rank: rows `[choiceCode, collegeCode, branch, roundI \| null, latestRound, branchGroup \| null]` for the cache year (groups as in the rank finder). Feeds the landing page ruler (TASK-0004) |
| GET | `/api/colleges/:code/fees` | FRA fees matched to the 5-digit college code; `year` is the entry's FRA academic year (2026-27, or 2025-26 when the college isn't on the newer report); `verified` only when the FRA order is linked, which the FRA report never does (#42) |
| POST | `/api/rank-finder` | FR-005. `candidature: "MH" \| "AI"` (#8). Each option has `firstRoundClosing`, `lastRoundClosing`, `rounds[]`, `source`, `list`, `district` |
| POST | `/api/simulate` | CAP replay of Rounds I–IV with the auto-freeze rule (#36): `rounds[]`, a per-choice `grid`, `freezeZones`, `assumptions` |
| GET | `/api/merit-estimate?percentile=&subjectGroup=` | MHT-CET percentile → state merit range (statistical until the state merit list is loaded, #10) |
| GET | `/api/jee-estimate?percentile=` | FR-006: JEE percentile → All India merit number from `merit_lookup` (list PCMAI); `kind: "jee-rank"` fallback is never used to search seats |
| POST | `/api/assistant` | FR-009, grounded answer as SSE: `{sources}` · `{delta}`* · `{done}` (#18) |

Planned:

| Method | Path | Auth | Entitlement | Purpose |
|---|---|---|---|---|
| GET/PUT | `/api/me/profile` | user | free | Saved rank, category, gender, flags |
| GET | `/api/me/usage` | user | free | Usage against plan limits |
| POST | `/api/billing/checkout` | user | free | Start a payment |
| POST | `/api/billing/webhook` | provider signature | n/a | Payment events; idempotent on provider event ID |

## POST /api/rank-finder
Request:
```json
{ "year": 2026, "merit": 2000, "category": "OPEN", "gender": "M",
  "flags": { "ews": false, "tfws": false }, "filters": { "district": null } }
```
Response:
```json
{ "options": [ { "collegeCode": "16006", "choiceCode": "1600619110", "branch": "Civil Engineering",
    "status": "round1", "seatType": "GOPENS", "closingMerit": 4148, "round": "I", "year": 2026 } ] }
```
Validation: `merit` positive integer; `category` from the glossary list; `gender` `M`|`F`.

## Demo mode
`npm run dev:demo -w @mhtcet/api` serves the real routes over an invented dataset
(`apps/api/src/demo`) with no database, and a deterministic stand-in for the language model.
The Playwright suite runs against it.

## Rate limits
`ASSUMPTION`: per-IP limit on public routes and per-user limit on the assistant, set in Phase 6.
