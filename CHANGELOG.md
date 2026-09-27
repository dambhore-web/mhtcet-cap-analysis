# Changelog

## Unreleased
### Fixed
- Ask Compass was down. Groq withdrew `llama-3.3-70b-versatile`, so every question returned a
  404. Found by the first eval run with a real key.
  - **New default model:** `openai/gpt-oss-120b`, with short, hidden reasoning and a larger token
    budget so the visible answer isn't cut off.
  - **CI eval** runs the set on three models so they can be compared (#19). Only the default
    model's result can fail the check.
  - **Eval runner** checks that the model exists before starting, and reports API errors as
    errors. It waits and retries when Groq's per-minute limit is hit.
  - **Fairer scoring** after the first full run (gpt-oss-120b: tools 91%, factual 72%, adversarial
    70%, grounding 96%). Several misses were the test's fault, not the model's:
    - Grounding now checks every row the tools returned, not only the cited ones.
    - Any valid row for the seat type and round counts, since a college can list one twice.
    - Cases use full branch names, and curly apostrophes match straight ones.
    - The safe fallback passes an adversarial case, because the attack got nothing through.
    - Latency leaves out the time spent waiting on rate limits.
    - The log prints each failed answer.
  - **100% pass marks** (owner decision): the eval fails unless the model gets every case right.
  - **Citation check** on every answer: each closing merit must share a sentence with a citation
    to the row it came from. This catches a real value quoted from the wrong row. A failing
    answer gets one rewrite with the exact problem, then the safe fallback.
- Ask Compass fixes found by the first real eval run:
  - **Initials in search:** "PICT", "COEP" and "VJTI Mumbai" now find their college. The search
    used to need the full name, so the model kept searching until it ran out of tool rounds.
  - **Out of tool rounds:** the model is now asked to answer from what it has. If Groq rejects a
    stray tool call (400 `tool_use_failed`), the user gets the safe fallback, not an error.
  - **Smaller tool results:** the model gets only each row's id and label (file and page stay
    in the citations), and at most 60 cutoff rows with a note to narrow. This cuts tokens per
    question, which matters under Groq's free-tier limit of 8,000 tokens a minute.

### Added
- Assistant eval set and runner (#20). Why: a prompt, model or tool change needs a measurable gate
  before it merges.
  - **Eval set:** 54 cases in `apps/api/evals/assistant.v1.jsonl` across six groups, including 10
    adversarial ones. Expected cutoffs are looked up in the loaded data, not typed in by hand.
  - **Runner:** `npm run eval` runs the real `runAssistant` loop and scores tool calls,
    correctness and numeric grounding. It exits 1 below the thresholds: 90% tools and factual,
    100% adversarial and grounding.
  - **CI:** the `Assistant eval` job runs when assistant code changes and `GROQ_API_KEY` is set.
  - The old `packages/pipeline/eval` set is replaced. It posted the wrong request shape and
    expected facts the tools can't provide (for example, the documents needed at reporting).
- Performance check and fixes (#27). Why: NFR-002 and NFR-003 had no measurement. Measured at
  full scale (390 colleges, 3,120 branches), a search took 38 ms of CPU and returned 1.7 MB.
  - **Script:** `npm run perf` runs 50 concurrent rank-finder users for 20 s, each pausing 1–3 s
    between searches (target p95 < 1 s). It also asks 10 assistant questions (target: first
    streamed text p95 < 3 s). `--think-ms=0` finds the saturation point.
  - **Faster rank finder:** `rankFind` summarises each branch's rows once and reuses the summary.
    Eligibility is worked out once per college, not per branch. A search now takes 13 ms, and its
    output is byte-identical to before over 400 varied requests.
  - **Compression:** JSON responses are gzipped when the browser accepts it. A full search drops
    from 1.7 MB to about 70 KB, which matters most on phones. The assistant's stream is not
    compressed.
  - **Result:** at full scale, p95 is 241 ms with 50 users. With no pause between searches, the
    server handles about 47 searches a second on 4 cores (p95 about 1.5 s).
  - **CI:** the `Performance (staging data)` job runs the script against the API loaded with the
    staging cutoffs.

### Changed
- Decision log matches the build (#118). Why: it said Tailwind and left hosting open, while the
  app uses plain CSS and the web app was deploying to Vercel.
  - **Styling:** plain CSS with design tokens, no Tailwind (owner confirmed). `AGENTS.md` and the
    architecture doc updated.
  - **Hosting:** web and API both on Railway; Vercel retired (owner decision).
    `09-devops/deployment.md` has the setup and the Vercel removal steps.
  - **Railway configs fixed:** both services now build from the repo root, since the web app and
    the API import `packages/core`. The old API config called a `build` script that core doesn't
    have, and the web config couldn't see core.
  - Root `package.json` requires Node 22.12 or later (Vite 7 needs it).

### Added
- Journeys J1–J13 built and tested end to end (issues in #119). Why: the audit found most of
  the planned product unbuilt or broken; each journey now has a passing Playwright spec.
  - **Tests (#112):** e2e runs the real API over an invented demo dataset
    (`npm run dev:demo -w @mhtcet/api`), so it needs no database. CI runs it on PRs into Dev
    and main, plus a staging smoke test when `DATABASE_URL_STAGING` is set. A unit test fails
    if any route has no link to it.
  - **Engine and API:**
    - Simulator replays Rounds I–IV with the auto-freeze rule, as `simulateCap` in core (#36).
    - Rank finder: All India candidature, Round I and last-round closing, and source file/page
      on every option (#8, #114).
    - JEE percentile uses the All India merit list (#8).
    - Fees are matched to real college codes and marked verified or unverified (#42).
    - Ask Compass answers only from tools, with citations and a number check (#18).
    - New `/api/meta` endpoint; district and type filters on colleges (#114, #115).
  - **Web:**
    - Navigation: six nav places with an option-form counter, and five My CAP plan steps
      (#79, #80).
    - Planning pages: By branch, Export with Excel, After allotment, Add options, Family summary
      link (#81, #83, #84, #113, #116).
    - Find, college and compare: freeze-zone markers and checks on the option form, what-if
      slider and ladders on Find, college page eligible-seat filter and table view, Compare on
      one scale (#86, #87, #88, #90, #92).
    - New and reworked pages: Eligibility, "Where our numbers come from", Ask with sources,
      Branch trends (#82, #85, #89, #91, #114).
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
