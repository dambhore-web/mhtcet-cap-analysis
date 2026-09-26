# Decision log

| Date | Decision | Reason | Owner | Record |
|---|---|---|---|---|
| 2026-09-27 | Separate repo from GUPO | Different product | user | — |
| 2026-09-27 | TypeScript only, no Python | Owner preference; one language | user | ADR-001 |
| 2026-09-27 | Paid product | Owner's goal | user | ADR-005 |
| 2026-09-27 | AI assistant in scope from the start | Owner's goal | user | ADR-004 |
| 2026-09-27 | React + Vite + Tailwind for web | Familiar from GUPO | user | — |
| 2026-09-27 | Trimmed documentation tree | Only document what applies | user | `00-project/scope.md` |
| 2026-09-27 | Monorepo with shared `packages/core` | One source of admissions logic | Claude, approved in plan | ADR-002 |
| 2026-09-27 | No candidate names or IDs in the product | Privacy, minors | Claude, approved in plan | ADR-003 |
| 2026-09-27 | AG-002 Data Ingestion Agent (Claude Code subagent) builds the data layer: writes extraction code, runs it, validates, loads the DB. Runs at the start, not on a schedule | Owner's direction | user | ADR-006 |
| 2026-09-27 | AG-002 writes code, runs, validates, commits on its branch and loads staging automatically when all checks pass; production load, push and merge need approval | Keeps prod changes human-approved | user | AG-002 spec |
| 2026-09-27 | Database: Supabase (Postgres), separate staging and production projects | Known from GUPO | user | `09-devops/environments.md` |
| 2026-09-27 | Official cutoff lists as the primary cutoff source; allotment lists secondary | Covers all colleges in ~9 files; matches computed values exactly | Claude, pending owner review | ADR-006 |

## Open decisions
| Decision | Needed by |
|---|---|
| API framework (Hono recommended) | Phase 6 |
| Auth provider (Supabase Auth recommended, since the DB is Supabase) | Phase 6 |
| Hosting (Railway recommended) | Phase 6 |
| Payment provider (Razorpay recommended) | Phase 8 |
| Plans, prices, free vs paid split | Phase 8 |
| LLM provider and model (chosen on eval results) | Phase 7 |
| Store assistant conversations? Retention? | Phase 7 |
| Marathi support | Phase 6 |
| Legal reviewer | before Phase 9 |
