# Project status

_Last updated: 2026-09-27_

## Current phase
**Phase 2 done / Phase 4–5 started** — the 2026 data layer is built by AG-002 on branch
`data/2026-initial` (not pushed, not merged; awaiting operator review).

## Completed
- Phase 0 discovery: `docs/00-project/project-discovery.md`
- Phase 1 foundation docs (branch `docs/foundation`)
- COEP (16006) 2026 Rounds I–IV analysed; dashboard in `dashboards/coep-2026.html`
- AG-002 Data Ingestion Agent specified (`docs/06-agents/AG-002-data-ingestion-agent.md`,
  `.claude/agents/data-ingestion.md`); official all-college cutoff lists found (ADR-006)
- Supabase staging project connected from local `.env`
- **TASK-0002 (Phase 2):** npm workspaces `packages/core` + `packages/pipeline`; the Python
  prototype is replaced and deleted. Parity: allotment 5,468/5,468 rows with 0 unexplained
  differences (three Python bugs fixed); All India merit 240,141 rows (Python 240,114), 0 mismatches;
  COEP All India rows 948/948 match the merit list.
- **2026 data layer (Phase 4–5 start):**
  - discover → `data/raw/2026/manifest.json` (9 cutoff lists, 16 merit lists, seat matrix,
    1,548 allotment links for 387 colleges, 26 links to 2023–2025 files)
  - official cutoff lists parsed for all colleges, Rounds I–IV (MH, AI) and Diploma (IV):
    111,757 rows, 0 parse issues
  - allotment lists for COEP + 5 sample colleges (03012, 01012, 03183, 02189, 06007): CAP Seats
    check 352/352 branch lists; Round I official-vs-computed cross-check 995/995
  - staging DB (migration `001_initial_schema.sql`): college 387, branch 2,333, cutoff 111,754,
    merit_lookup 240,141; loads are idempotent (checksums identical on re-run)
  - multi-state readiness: `authority` + `exam` on all tables and core types (operator decision)
- Tests: 33 vitest tests with synthetic fixtures, incl. a privacy regression test for masking

## In progress
- **Journeys J1–J13 (tracking #119)** on branch `claude/magical-ritchie-wcwhc0`, for review into
  `Dev`. All 13 pass end to end on the demo dataset (`apps/web/e2e/journeys`). Blocked:
  - J14 and accounts: need sign-in and payment decisions/credentials (#15, #21, #34, #117).
  - Earlier years (2023–2025) and districts: loaded to staging on 2026-09-28 through the
    "Staging data load" workflow (codes normalised to the 2026 form). Seats left (#40) still open.
  - FRA fees (#42): done 2026-09-28 with `npm run fees -w @mhtcet/pipeline`: 319 of 387 current
    colleges (313 FRA 2026-27, 6 FRA 2025-26). The 27 government/aided/university colleges and 41
    unaided colleges not on the FRA report have no fees. The FRA report has no TFWS data or order
    links, so no entry is "verified".
- **Seat matrix data (#40, first half):** parser, checks, migration `003_seat_matrix.sql` and
  staging loader for 2023–2026 (1,900 / 2,055 / 2,181 / 2,307 branches; every branch's printed
  totals add up). The "seats left" half of #40 is still open.
- **UI audit fixes (issues #93–#108, tracking #109)** on branch `claude/magical-ritchie-wcwhc0`, for
  review into `Dev`: design tokens (one type scale, radii, colours), one top navigation with account
  menu and mobile menu, shared page header and container, error boundary and validated local
  storage, grouped Find results, plain-language seat labels (NT1/2/3 = NT-B/C/D), new
  `/estimate` page, CAP guide with How CAP works and Seat codes tabs, empty states, self-hosted fonts.
  Checked at 360, 390, 768 and 1440 px with no horizontal overflow.
- **TASK-0003: responsive web app** (branch `feat/web-app`), rank finder first. Start here:
  `tasks/TASK-0003.md` has the plan, the mockups link and the data findings needed for the rank finder.
- `data/2026-initial` reviewed, merged to `main` and pushed (a841b85). Production DB not loaded (owner decision)

## Blocked
Nothing is blocked. The paid launch is gated on the legal items in `docs/07-security/legal-open-items.md`.

## Next steps
- Placement data for the 243 colleges still without it (#134): list in `docs/00-project/backlog.md`.
1. Operator reviews `data/2026-initial` (and `reports/run-*.json`); decides on push/merge and a
   production load (needs explicit approval)
2. Full allotment crawl (1,548 PDFs) and parser hardening for any new layouts (Phase 5)
3. `buildDashboard` in TypeScript to regenerate the COEP dashboard from repo code (TASK-0002 leftover)
4. Phase 3: CI running `npm run typecheck` and `npm test`
5. Earlier years (2023–2025 cutoff lists are linked from the 2026 home page)

## Phases
| # | Phase | Status |
|---|---|---|
| 0 | Discovery | done |
| 1 | Foundation docs | done (branch `docs/foundation`) |
| 2 | TypeScript port → monorepo packages | done except dashboard rebuild |
| 3 | Tests + CI | tests done (33); CI not started |
| 4 | Official cutoff-list parser (all colleges) + allotment parser hardening on 5 varied colleges | done for 2026 |
| 5 | All colleges, 2026, ingested by AG-002 with cross-check report | cutoffs loaded to staging; full allotment crawl not started |
| 6 | API + DB + auth + rank finder + web app (free tier) | not started |
| 7 | AI assistant (eval set first) | not started |
| 8 | Payments, entitlements, usage metering | not started |
| 9 | Security review, legal sign-off, observability, launch | not started |
| 10 | Earlier years | not started |

## Product decisions (2026-09-27)
Name **Compass** · Maharashtra first, other states later (ADR-007) · build locally, host web and API on
Railway (Vercel retired, #118) · plain CSS, no Tailwind · Google sign-in only · English only · free vs paid parked. UI mockups:
https://claude.ai/artifact/AMQz7i84DpLtphboyZUZuD (private, 30 screens + journey map; supersedes
the earlier phone mockup). Navigation and the 14 user journeys: `docs/02-architecture/navigation.md`. All decisions: `docs/DECISIONS.md`.

## Known risks
Commercial reuse of CET Cell data: owner confirmed permitted (L1–L3 resolved). Remaining
pre-launch legal items: disclaimer, privacy policy, terms (L4–L6). Data risks: later-round allotment cross-checks leave a few unexplained
differences per sample college (reported, not blocking); layouts of the other 381 colleges'
allotment lists are untested.

## Technical debt
- COEP dashboard data can't yet be regenerated from repo code (no `buildDashboard`)
- Allotment column x-windows are fixed to the 2026 layout (checked on 6 colleges)

## Architecture changes
ADR-001 to ADR-006 accepted. Schema: `packages/pipeline/migrations/001_initial_schema.sql`.

## AI / agent status
AG-002 ran its first build (this change). AG-001 designed only. LLM provider: `DECISION REQUIRED`.

## Test status
`npm run typecheck` clean; `npm test` 33/33 passing.

## Deployment status
Nothing deployed. Data exists only in the Supabase **staging** project. The COEP dashboard is a
private claude.ai artifact.
