# Changelog

## Unreleased
### Added
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

### Changed
- `.gitignore`: ignore `node_modules/`, build output and env files; `reports/` is committed
  (counts and cutoff values only, no personal data).
- `src/pdf.ts` moved to `packages/pipeline/src/pdf.ts` (now also returns word right edges).

### Removed
- Python prototype (`src/cap/*.py`, `requirements.txt`) after TypeScript parity was proven.

## 2026-09-27 — initial scaffold (7e0b14f)
- Python download and parser scripts, COEP 2026 dashboard, README.
