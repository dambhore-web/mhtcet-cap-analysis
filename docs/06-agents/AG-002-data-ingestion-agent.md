# AG-002 Data Ingestion Agent

| Field | Value |
|---|---|
| Agent ID | AG-002 |
| Name | Data Ingestion Agent |
| Purpose | Build the data layer at the start: study the CET Cell sources, write the extraction code, run it, validate the results and load them into the database |
| When it runs | **Once at the beginning** to build and fill the database. Later only when new data appears (new round or year) or a layout changes. It is not a scheduled job |
| Who uses it | The operator (project owner). Not user-facing |
| Runs as | Claude Code subagent `.claude/agents/data-ingestion.md`, working inside this repo |
| Key principle | The agent **writes code that extracts the data**; it never types numbers in itself. Every value in the database comes from committed, tested code that can be re-run (ADR-006) |

## What it does, in order
1. **Discover sources:** read the CET Cell pages for the year and list every file the app needs
   (official cutoff lists, institute list, institute-wise allotment lists, merit lists, seat
   matrix). Write `data/raw/<year>/manifest.json`.
2. **Download** the files in the manifest (cached, one request at a time, ≥ 1 s apart).
3. **Study the layouts:** open sample pages of each file type and note the structure: headers,
   sections, column positions, wrapped lines, codes.
4. **Write the extraction code** in `packages/pipeline` (TypeScript, per `AGENTS.md`):
   - a parser per source type (cutoff lists, allotment lists, merit lists, institute list)
   - seat-type grammar and shared types in `packages/core`
   - unit tests with synthetic fixtures (fake names and IDs, never real PDFs)
   - DB schema migrations for the tables it loads (`docs/03-domain/data-model.md`)
   - a `load` step that upserts into the database
5. **Run** the code on all files.
6. **Validate** with the checks below. If a check fails, fix the code and re-run until it passes,
   or stop and ask when the cause is unclear.
7. **Load** the validated data into the database (approval rules below).
8. **Report** what was built, run, validated and loaded, and open a branch with the code for review.

## Sources (2026, found 2026-09-27)
| Source | Where | Gives |
|---|---|---|
| Official cutoff lists (primary) | Linked from `fe<year>.mahacet.org`: `…/documents/<year>ENGG_CAP<n>_MH_CutOff[_V1].pdf` (state + minority), `…_CAP<n>_AI_CutOff.pdf`, `…_CAP4_Diploma_CutOff.pdf` | Closing merit + percentile for every college × branch × seat type × round. No candidate names |
| Institute list | `StaticPages/frmInstituteList.aspx` | College names, codes, district, university, status |
| Institute-wise allotment lists (secondary) | `StaticPages/frmInstituteWiseAllotmentList.aspx`: 1,548 links = 387 colleges × 4 rounds | Opening merit, seats filled, gender split, turnover; cross-check of cutoffs |
| All India merit list | `…/meritlists/final/FE<year>_PCMAI_MeritList_Final.pdf` | JEE percentile → All India merit number |
| State merit list | `UNKNOWN`, to find | Percentile → state merit number |
| Seat matrix | "Institute-wise Category-wise Seats" link | Seat counts per seat type |

College codes are 5 digits with leading zeros (e.g. `01002`, `16006`).

## Validation checks (all must pass before loading)
| Check | Rule |
|---|---|
| Seat count | Parsed allotment rows per branch = printed `CAP Seats: N` |
| Cutoff cross-check | Closing merit computed from allotment lists = official cutoff value, per branch × seat type × round |
| Coverage | Every college in the institute list has cutoff rows for every published round |
| Monotonic merit | Merit list percentiles never increase with merit number |
| Seat-type grammar | Every seat type parses with `packages/core` |
| Tests | `npm run typecheck` and `npm test` pass |
| No personal data | No `EN\d{8}` IDs or name fields in any output or DB row |

Baseline already confirmed: COEP 2026 Round I cutoffs computed from allotment lists match the
official cutoff list exactly (e.g. Civil GOPENS 4,148, AI & ML GOPENS 365).

## Execution policy
| Action | Rule |
|---|---|
| Read CET Cell pages, download public PDFs | Automatic, rate-limited |
| Write and edit code, tests and migrations | Automatic, on branch `data/<year>-<desc>` |
| Run parsers, validation, tests | Automatic |
| Load into the **staging** database | Automatic once every check passes (owner decision, 2026-09-27) |
| Load into the **production** database | Only with explicit operator approval in the same conversation |
| Commit | Automatic on its branch (owner decision, 2026-09-27) |
| Push, merge to `main` | Operator approval |
| Delete raw data, drop tables, delete DB rows outside an upsert | Never without explicit approval |

## Prerequisites
- Phase 2 structure (`packages/core`, `packages/pipeline`) or permission to create it.
- Database: **Supabase** (owner decision, 2026-09-27), separate staging and production projects.
  The loader connects with the Postgres connection string (`ASSUMPTION`: direct Postgres is
  better than the REST API for bulk upserts and migrations).
- `DATABASE_URL_STAGING` (and later `DATABASE_URL_PRODUCTION`) in the git-ignored `.env`, created
  by the operator (`09-devops/environments.md`). Never printed, logged or committed. Until
  `DATABASE_URL_STAGING` exists, the agent builds and validates everything and stops before loading.

## Outputs
Pipeline code + tests + migrations on a branch · `data/raw/<year>/manifest.json` ·
`reports/run-<timestamp>.json` · DB tables filled · a summary report:
**Built** (files and tests added) · **Ran** (files, rows per source) · **Checks** (pass/fail per
check, colleges failing) · **Loaded** (environment, rows per table) · **Needs operator**.

## Failure handling and escalation
- Site unreachable or file missing → retry with backoff, then report. Never guess URLs beyond known patterns.
- Layout it can't parse with confidence → stop, show the page and the failing rows, ask.
- Any personal data in outputs → stop immediately and report; nothing is loaded.
- Validation fails after fixes → load nothing for the failing colleges; report them.

## Evaluation
A run is good when every check passes for every loaded college, the cutoff cross-check has zero
unexplained mismatches, the tests cover each layout it handles, and re-running the code produces
identical DB contents.

## Cost
Runs on Claude Code (the operator's plan); no product LLM spend. Downloads about 40 MB of cutoff
lists and about 1 GB of allotment lists per year.
