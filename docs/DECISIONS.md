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
| 2026-09-27 | Official cutoff lists as the primary cutoff source; allotment lists secondary | Covers all colleges in ~9 files; 995/995 Round I values match computed ones | Claude; confirmed by the first AG-002 run | ADR-006 |
| 2026-09-27 | Product name: **Compass** (domain decided later) | Owner's choice; works for all-India | user | — |
| 2026-09-27 | All-India later; `authority` + `exam` on every record now | Other states planned | user | ADR-007 |
| 2026-09-27 | Commercial reuse of CET Cell data is permitted | Owner confirmed | user | `07-security/legal-open-items.md` |
| 2026-09-27 | Build locally first; host on Railway | Known from GUPO | user | `09-devops/environments.md` |
| 2026-09-27 | Sign-in: Google only for now (phone OTP dropped; needs SMS provider + DLT) | Simplest to launch | user | — |
| 2026-09-27 | English only at launch | Scope | user | NFR-005 |
| 2026-09-27 | Free vs paid split parked; build features ungated first | Decide later | user | `01-requirements/pricing-and-plans.md` |
| 2026-09-27 | Cutoff key includes stage + exam; Diploma rows stored with empty seat type; `ORPHAN2` and a duplicated AI key not loaded | Source quirks | Claude, accepted by user | `02-architecture/data-pipeline.md` |
| 2026-09-27 | "Later round" status uses the highest closing published in Rounds II–IV (round values cover only that round's allotments) | Matches how the official lists work | Claude | `03-domain/eligibility-rules.md` §6 |

## Open decisions
| Decision | Needed by |
|---|---|
| API framework (Hono recommended) | Phase 6 |
| Auth provider (Supabase Auth recommended; Google only) | Phase 6 |
| Payment provider (Razorpay recommended) | Phase 8 |
| Plans, prices, free vs paid split (parked) | Phase 8 |
| LLM provider and model (chosen on eval results) | Phase 7 |
| Store assistant conversations? Retention? | Phase 7 |
| Domain | before launch |
| Disclaimer, privacy policy, terms (L4–L6) | before Phase 9 |
