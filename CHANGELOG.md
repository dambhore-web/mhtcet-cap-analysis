# Changelog

## Unreleased
### Added
- `docs/02-architecture/navigation.md`: navigation rules, site map with status, the My CAP plan
  steps and the 14 user journeys from the clickable mockup, each linked to the issues that
  complete it. Why: the journeys lived only in the design canvas, and feature issues didn't say
  which user question they answer.
- Web UI audit fixes (issues #93–#108). Why: the Dev audit found inconsistent sizes, fonts,
  widths and navigation, wrong seat-type labels and pages that went blank on bad saved data.
  - `apps/web`: tokens for type, radii, colours and layout; `PageHeader`, `Icon`, `PlanSubnav`,
    `ErrorBoundary`; one top nav (Find, Colleges, My CAP plan, Ask, CAP guide) with an account menu;
    compare bar only where colleges are browsed; bottom nav removed.
  - Seat labels from the seat-type grammar (`lib/seatType.ts`); NT1/NT2/NT3 shown as NT-B/C/D.
  - Rounds always written "Round I" style; college page reads the API's Roman-numeral rounds
    (its headline previously never showed).
  - Find results grouped by college; new `/estimate` page; guide tabs linkable with `?tab=`;
    plans and question limits read from `lib/plans.ts`; option form limit shown as 300.
  - Saved profile, list, compare and session data are shape-checked on load.
  - Fonts self-hosted with `@fontsource` instead of Google Fonts.
  - 15 new vitest tests in `apps/web/test/`.
- Foundation documentation: `AGENTS.md`, `CLAUDE.md`, `PROJECT_STATUS.md`, `docs/` tree, ADR-001
  to ADR-005, task files. Why: the project is becoming a paid, AI-assisted product and needs
  written rules, architecture and decisions before more code.
- `src/pdf.ts`, `tsconfig.json`, `package.json`: start of the TypeScript port (ADR-001).

- AG-002 Data Ingestion Agent: spec, agent registry, pipeline tools, Claude Code subagent
  `.claude/agents/data-ingestion.md`, ADR-006. Why: the owner wants one agent that gathers and
  parses the data the app needs. Official cutoff lists found on the CET Cell site become the
  primary source.

- 2026 data layer (TASK-0002, AG-002 first build, branch `data/2026-initial`). Why: replace the
  Python prototype with reproducible TypeScript code (ADR-001/002) and use the official cutoff
  lists as the primary source (ADR-006).
  - `packages/core`: shared types with `authority` + `exam` (multi-state readiness, operator
    decision), seat-type grammar, per-authority rules registry (`MH-CET-CELL`), `computeCutoffs`.
  - `packages/pipeline`: `discover`, `download` (host allow-list, ≥ 1.1 s gap, cache, `%PDF`
    check), parsers for the MH / AI / Diploma cutoff lists, allotment lists, All India merit list
    and institute list; `validate` (run report in `reports/`), `migrate`, `load` (staging only,
    idempotent upserts), `db:checksum`; `dumpPage` layout tool with masking.
  - `packages/pipeline/migrations/001_initial_schema.sql`: `ingest_run`, `college`, `branch`,
    `cutoff`, `merit_lookup`.
  - 33 vitest tests on synthetic fixtures, including a privacy regression test.
  - Staging loaded: college 387, branch 2,333, cutoff 111,754, merit_lookup 240,141.

- `docs/02-architecture/data-sources.md`: catalogue of every CET Cell source (cutoffs 2023–2026,
  merit lists, seat matrix, vacancy lists, institute lists) plus external sources (FRA fees and
  districts: 306/387 colleges match; NIRF, NBA, NAAC, AICTE).
- `docs/adr/ADR-007-multi-authority-data-model.md`; product decisions (name Compass, Google
  sign-in only, English only, Railway, free vs paid parked) in `docs/DECISIONS.md`.

### Changed
- `docs/03-domain/eligibility-rules.md`: rewritten from the 2026-27 CAP admission brochure (seat
  split, Home University, reservations, allotment stages). Matching now uses the highest closing
  published in later rounds, because each round's official value covers only that round's allotments.
- `docs/07-security/legal-open-items.md`: L1–L3 resolved (owner confirmed data reuse).
- `.gitignore`: ignore `node_modules/`, build output and env files; `reports/` is committed
  (counts and cutoff values only, no personal data).
- `src/pdf.ts` moved to `packages/pipeline/src/pdf.ts` (now also returns word right edges).

### Removed
- Python prototype (`src/cap/*.py`, `requirements.txt`) after TypeScript parity was proven.

## 2026-09-27 — initial scaffold (7e0b14f)
- Python download and parser scripts, COEP 2026 dashboard, README.
