# Project status

_Last updated: 2026-09-27_

## Current phase
**Phase 1 — Foundation docs** (branch `docs/foundation`, not yet committed)

## Completed
- Phase 0 discovery: `docs/00-project/project-discovery.md`
- COEP (16006) 2026 Rounds I–IV analysed; dashboard in `dashboards/coep-2026.html`
- 2026 All India (PCM) merit list parsed and joined to COEP All India seats
- Private GitHub repo created
- TypeScript PDF reader `src/pdf.ts`: word positions verified against the earlier Python output

- AG-002 Data Ingestion Agent specified (`docs/06-agents/AG-002-data-ingestion-agent.md`) with a
  Claude Code subagent definition (`.claude/agents/data-ingestion.md`)
- Found the official all-college cutoff lists and the full college list on the CET Cell site
  (387 colleges); COEP cutoffs match exactly (ADR-006)

- Supabase staging project `mtuzpfrlptfceemrxkgo` connected from local `.env`
  (PostgreSQL 17.6, `public` schema empty). `pg` driver installed

## In progress
- Phase 1: foundation documentation (this set of files)
- Phase 2 (paused): TypeScript port of the pipeline. `package.json`, `tsconfig.json` and
  `src/pdf.ts` exist; download, parsers, summarise and dashboard build not written yet.

## Blocked
Nothing is blocked. The paid launch is gated on the legal items in `docs/07-security/legal-open-items.md`.

## Next steps
1. User reviews Phase 1 docs → commit on `docs/foundation`
2. Phase 2: finish the TS port into `packages/pipeline` + `packages/core`, prove parity with the
   Python output, delete the Python code
3. Phase 3: tests + CI

## Phases
| # | Phase | Status |
|---|---|---|
| 0 | Discovery | done |
| 1 | Foundation docs | in progress |
| 2 | TypeScript port → monorepo packages | paused, ~15% |
| 3 | Tests + CI | not started |
| 4 | Official cutoff-list parser (all colleges) + allotment parser hardening on 5 varied colleges; run by AG-002 | not started |
| 5 | All colleges, 2026, ingested by AG-002 with cross-check report | not started |
| 6 | API + DB + auth + rank finder + web app (free tier) | not started |
| 7 | AI assistant (eval set first) | not started |
| 8 | Payments, entitlements, usage metering | not started |
| 9 | Security review, legal sign-off, observability, launch | not started |
| 10 | Earlier years | not started |

## Known risks
See `docs/00-project/project-discovery.md` §Risks. Top risk: commercial reuse terms for CET Cell
data are `UNKNOWN`.

## Technical debt
- Python code in `src/cap/` still committed (removed in Phase 2)
- COEP dashboard data can't be regenerated from repo code (fixed in Phase 2)
- Parser uses fixed column positions tuned to one college (fixed in Phase 4)

## Architecture changes
ADR-001 to ADR-005 accepted on 2026-09-27 (see `docs/adr/`).

## AI / agent status
Designed only (`docs/05-ai/`, `docs/06-agents/`). No code. LLM provider: `DECISION REQUIRED`.

## Test status
No automated tests yet.

## Deployment status
Nothing deployed. The COEP dashboard is a private claude.ai artifact.
