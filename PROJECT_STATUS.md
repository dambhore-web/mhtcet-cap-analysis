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
- Operator review of branch `data/2026-initial`

## Blocked
Nothing is blocked. The paid launch is gated on the legal items in `docs/07-security/legal-open-items.md`.

## Next steps
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

## Known risks
See `docs/00-project/project-discovery.md` §Risks. Top risk: commercial reuse terms for CET Cell
data are `UNKNOWN`. Data risks: later-round allotment cross-checks leave a few unexplained
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
