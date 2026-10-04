# Project status

_Last updated: 2026-10-03_

## Current phase
**Phase 6 (free-tier web app) live on Railway; Phases 7–9 not started.** The free app (Find colleges,
college and branch pages, option form, simulator, guide, SEO pages) runs from `Dev`, and `main`
matches `Dev` (7193ded). The paid launch waits on payments, the security review and the legal items.

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
- **2026 data layer (Phase 4–5 start):** reviewed, merged to `main` (a841b85). Production DB not
  loaded (owner decision).
  - discover → `data/raw/2026/manifest.json` (9 cutoff lists, 16 merit lists, seat matrix,
    1,548 allotment links for 387 colleges, 26 links to 2023–2025 files)
  - official cutoff lists parsed for all colleges, Rounds I–IV (MH, AI) and Diploma (IV):
    111,757 rows, 0 parse issues
  - allotment lists for COEP + 5 sample colleges (03012, 01012, 03183, 02189, 06007): CAP Seats
    check 352/352 branch lists; Round I official-vs-computed cross-check 995/995
  - staging DB (migration `001_initial_schema.sql`): college 387, branch 2,333, cutoff 111,754,
    merit_lookup 240,141; loads are idempotent (checksums identical on re-run)
  - multi-state readiness: `authority` + `exam` on all tables and core types (operator decision)
- **Earlier years (2023–2025) and districts:** loaded to staging on 2026-09-28 through the
  "Staging data load" workflow (codes normalised to the 2026 form).
- **FRA fees (#42):** 2026-09-28 with `npm run fees -w @mhtcet/pipeline`: 319 of 387 current
  colleges (313 FRA 2026-27, 6 FRA 2025-26). The 27 government/aided/university colleges and 41
  unaided colleges not on the FRA report have no fees. The FRA report has no TFWS data or order
  links, so no entry is "verified".
- **Seat matrix (#40, closed 2026-09-28):** parser, checks, migration `003_seat_matrix.sql` and
  staging loader for 2023–2026 (1,900 / 2,055 / 2,181 / 2,307 branches; every branch's printed
  totals add up).
- **CI (Phase 3):** `.github/workflows/ci.yml` runs typecheck, tests, `npm audit`, Playwright e2e,
  data audit, perf and the AI eval.
- **App redesign (TASK-0004)** to the October 2026 mockups in `docs/mockups/`: merged into `Dev`.
- **UI audit fixes (#93–#108, tracking #109)** and **journeys J1–J13 (tracking #119)**: in `Dev`;
  all 13 journeys pass end to end on the demo dataset (`apps/web/e2e/journeys`).
- **#136** Find colleges: Likely / Target / Reach tiles (Reach = up to 10% worse than last
  year's closing; `docs/03-domain/result-bands.md`). **#138** College page section links. **#137**
  Option form coverage. **#135** Next-step card. **#15** Google sign-in (staging). **#139** My
  account dashboard. Fix: colleges without state-level open seats (254 of 387) now shown.
- **SEO (2026-10-03):** prerendered HTML for every public page (2,727 pages on 2026 data);
  district and branch-group landing pages; four colleges' districts fixed (migration 009).
- **Railway deploy (2026-10-03):** staging and production services deploy from `Dev`
  (EBUSY build fix: `npm install --include=dev`, not `npm ci`).
- **Percentile search (2026-10-03):** Find, the questions and the landing page take a percentile
  or a merit number; a percentile is matched against each row's printed closing percentile;
  results switch between percentile and merit views (`GET /api/percentile-scale`). All India: a JEE
  percentile is within every AI row past the JEE block (rule 10(2)); on 2026 AI data it agrees with
  the All India merit number in 199,932 of 200,018 checks (the rest are exact percentile ties).

## In progress
- **`buildDashboard` (#13):** `packages/pipeline/src/buildDashboard.ts` started in the main
  checkout, not committed. Regenerates the COEP dashboard from repo code.

## Blocked
- **Paid launch:** needs owner decisions and credentials for payments (#21, #34), usage metering
  (#22), the full security review (#25) and its follow-ups (#131), and the legal items L4–L6 in
  `docs/07-security/legal-open-items.md`.
- **Accounts and J14** (#117: saved work, CAP calendar, deadline emails): needs the sign-in and
  payment decisions.
- **AI assistant (Phase 7):** LLM provider `DECISION REQUIRED` (#19); evaluation set (#20).

## Next steps
1. Finish and commit `buildDashboard` (#13).
2. Placement data for the 243 colleges still without it (#134): list in `docs/00-project/backlog.md`.
3. Full allotment crawl (1,548 PDFs) and parser hardening for any new layouts (Phase 5; AG-002).
4. Performance targets (#27): rank finder p95 < 1 s, assistant first token p95 < 3 s.
5. Owner decisions for the paid launch (see Blocked).
6. Housekeeping: decide on the two unmerged branches, probably superseded by `Dev`:
   `origin/claude/magical-ritchie-wcwhc0` (1 commit, 2026-09-29: answer tiles with dropdowns, #142)
   and `feat/web-app` (3 commits, 2026-09-27: TASK-0003 start). Close #45 (Marathi, descoped).

## Phases
| # | Phase | Status |
|---|---|---|
| 0 | Discovery | done |
| 1 | Foundation docs | done (branch `docs/foundation`) |
| 2 | TypeScript port → monorepo packages | done except dashboard rebuild (#13, in progress) |
| 3 | Tests + CI | done (`ci.yml`) |
| 4 | Official cutoff-list parser (all colleges) + allotment parser hardening on 5 varied colleges | done for 2026 |
| 5 | All colleges, 2026, ingested by AG-002 with cross-check report | cutoffs loaded to staging; full allotment crawl not started |
| 6 | API + DB + auth + rank finder + web app (free tier) | live on Railway from `Dev`; Google sign-in on staging |
| 7 | AI assistant (eval set first) | Groq prototype (`POST /api/assistant`); provider decision and eval set open |
| 8 | Payments, entitlements, usage metering | not started (blocked on decisions) |
| 9 | Security review, legal sign-off, observability, launch | access logs and request IDs done (#26); review not started |
| 10 | Earlier years | 2023–2025 loaded to staging |

## Product decisions (2026-09-27)
Name **Compass** · Maharashtra first, other states later (ADR-007) · build locally, host web and API on
Railway (Vercel retired, #118) · plain CSS, no Tailwind · Google sign-in only · English only (Marathi
#45 descoped) · free vs paid parked. Reach band = up to 10% worse than last year's closing (2026-10-02, #136). UI mockups:
https://claude.ai/artifact/AMQz7i84DpLtphboyZUZuD (private, 30 screens + journey map; supersedes
the earlier phone mockup). Navigation and the 14 user journeys: `docs/02-architecture/navigation.md`. All decisions: `docs/DECISIONS.md`.

## Known risks
Commercial reuse of CET Cell data: owner confirmed permitted (L1–L3 resolved). Remaining
pre-launch legal items: disclaimer, privacy policy, terms (L4–L6). Data risks: later-round allotment cross-checks leave a few unexplained
differences per sample college (reported, not blocking); layouts of the other 381 colleges'
allotment lists are untested. Percentile search can't split students tied on the same percentile.

## Technical debt
- COEP dashboard data can't yet be regenerated from repo code (`buildDashboard`, #13, in progress)
- Allotment column x-windows are fixed to the 2026 layout (checked on 6 colleges)

## Architecture changes
ADR-001 to ADR-006 accepted. Schema: `packages/pipeline/migrations/` (001 initial schema to
009 college district fix).

## AI / agent status
AG-002 ran its first build. AG-001 designed only. Assistant prototype on Groq (llama-3.1-8b-instant);
LLM provider: `DECISION REQUIRED` (#19).

## Test status
`npm run typecheck` clean; `npm test` 469/469 passing (2026-10-03). Playwright e2e 55/55 on the demo
dataset (last full run 2026-10-02; landing-page specs re-run 2026-10-03).

## Deployment status
Railway project **getmecollege**: staging and production web + API services, all deploying from
`Dev`. `main` matches `Dev` (7193ded, 2026-10-03). Data: Supabase **staging** project (production DB
not loaded, owner decision). The COEP dashboard is a private claude.ai artifact.
