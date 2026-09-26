# API contracts

Status: draft for Phase 6. An OpenAPI file will replace this table once the framework is chosen.
All routes are under `/api`, JSON in and out, request bodies schema-validated, errors per
`error-model.md`.

| Method | Path | Auth | Entitlement | Purpose |
|---|---|---|---|---|
| GET | `/api/years` | none | free | Years with loaded data |
| GET | `/api/colleges?year=&q=&district=&university=` | none | free | College search, paginated (`limit`, `cursor`) |
| GET | `/api/colleges/:code/cutoffs?year=` | none / user | free: `DECISION REQUIRED` how much | Cutoffs per branch × seat type × round |
| POST | `/api/rank-finder` | user | free: limited · paid: full (`DECISION REQUIRED`) | FR-005 |
| POST | `/api/jee/rank` | none | free | FR-006: percentile → estimated All India merit no |
| POST | `/api/assistant` | user | paid | FR-009, streamed response |
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

## Rate limits
`ASSUMPTION`: per-IP limit on public routes and per-user limit on the assistant, set in Phase 6.
