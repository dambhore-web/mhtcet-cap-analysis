# Changelog

## Unreleased
### Fixed
- Web: the Content Security Policy now allows the Supabase origin; built deployments would
  otherwise have blocked sign-in and sync (#131).
- API: a dropped idle database connection no longer crashes the process (logged as `db_idle_error`).
- Colleges, landing, by-branch and estimate: 254 of 387 colleges were missing ("No state-level
  open seats") because only GOPENS was used, and most university-affiliated colleges have only
  home / other-than-home-university open seats. `open-latest` now falls back to GOPENO, GOPENH, then
  ladies open seats, and says which per row; the colleges list labels non-state-level strips.
### Security
- Supabase "RLS disabled": every data table in `public` (cutoff, merit_lookup, college, fee, ...)
  allowed the public anon key to read, change and delete rows through Supabase's REST API.
  Migration 008 turns row-level security on for every table, revokes anon/authenticated rights
  (signed-in students keep their own `user_store` rows) and closes future tables by default.
  Applied to staging; the API reads as the table owner and is unaffected. The `compass_api` role
  setup now includes read policies.
- #131 follow-ups: `DATABASE_CA_CERT` verifies the database certificate (API and pipeline); in
  production the API warns at startup about a missing `CORS_ORIGINS`, CA certificate or read-only
  role; `npm run check:supabase -w @mhtcet/web` checks a project's sign-in setup; every held-back
  production step is listed in `docs/09-devops/production-rollout.md`.
### Changed
- No paid plans while payments are deferred until there is traffic (owner decision 2026-10-02):
  `PAYMENTS_ENABLED = false` in `apps/web/src/lib/plans.ts` hides every Plans link and upgrade
  prompt, `/plans` goes home, Ask Compass's limit messages no longer sell a Season Pass, the API's
  rate-limit message no longer says "Upgrade", and the Terms say Compass is free (sections on paid
  plans, refunds and GST removed).
### Added
- My account (#139): `/profile` is now a dashboard with your numbers, the next step, the option
  form (count, top five, last edit, links) and a CAP timeline read from sourced CET Cell dates
  (`apps/web/src/data/capCalendar.ts`; hidden until a schedule is published). The details form
  moved to `/profile/details`.
- Google sign-in with Supabase Auth (#15). Signed in, details, option form, compare list, allotment
  and CAP progress follow the student across devices (`user_store`, row-level security; newest copy
  of each piece wins). My details shows the account, sync state, sign out and delete saved data.
  Without `VITE_SUPABASE_*` the app runs as before. Setup: `docs/09-devops/google-sign-in.md`;
  privacy policy updated.
- Find colleges: a "What should I do next?" card (#135) with one action for the student's CAP
  stage (estimate, add choices, test, export, allotment, family summary). Progress dates kept in
  this browser (`compass_progress_v1`); After allotment gets "I've made my choice on the CET Cell
  portal".
- Option form checks: a Coverage block (#137) with the list's Likely / Target / Reach bar,
  branch groups, districts and size, and two suggestions: more than 80% in one branch group, or
  every choice in one district (lists of 5+). Branch groups moved to core (`branchGroupOf`).
- Find colleges: Likely / Target / Reach tiles above the results (#136). Likely = within last
  year's Round I closing, Target = within a later round, Reach = at most 10% worse than the
  closing (`bandOf` in core, `docs/03-domain/result-bands.md`). A tile filters the list; option
  badges lead with the band. Never "safe".
- College page: a sticky row of section links, Cutoffs · Branches · Fees · Placement, only for
  the sections the college has (#138). Each section has its own URL (`/colleges/16006#placement`)
  and the active link follows the scroll.
- App redesign from the October 2026 mockups (TASK-0004, `docs/mockups/`), on branch
  `feat/app-redesign`.
  - Type: Anek Latin for headings and big figures, Geist Mono for small figures, Poppins for text;
    the Calm blue palette is unchanged. Cards, buttons, top nav, footer and the My CAP plan steps
    (a numbered rail) follow.
  - The merit ruler: a log-scale strip of closing ranks with a pin for the student (drag, click or
    arrow keys). Landing: every branch as a barcode. Find colleges: every option, and the pin is
    the "what if my merit were…" control. College: its branches. Branch trends: one tick per year.
    Onboarding: at the merit step.
  - Branch trends: per-year vertical dumbbells (Round I to final round), every seat type in one
    chart with the table folded, chances by year, other branches at the college.
  - Charts share one encoding: Round I hollow blue, latest round amber, the student's merit as a
    dashed line; the cutoff chart's right-hand value column is gone (hover shows every round).
  - Colleges list: a strip of each college's branch cutoffs and "N of M within reach", sortable.
  - Option form: the auto-freeze zones drawn as bars down the list.
  - Compare: every branch on one chart with one mark shape per college. Eligibility: what each
    special seat adds for the student. My details: the seat codes the answers unlock (from core).
    CAP guide: a seat-code decoder. Export: big numbered choice codes. Family summary: an A4 sheet.
    Merit estimate: the range as a band over every branch. Simulator: rounds reveal in turn.
  - API: `GET /api/cutoffs/open-latest`, every branch's GOPENS Round I and latest-round closing
    rank with its branch group, for the landing, colleges, by-branch and estimate pages.
- Answer tiles on Find colleges (#142). The answers from the step-by-step questions (exam, merit
  number, category, gender, home university, special seats, minority community, branches) sit as
  tiles above the results. Each one changes with a dropdown and the results update straight away,
  so a student never has to answer the questions again; changed answers are saved to My details.
  On a phone the tiles fold into one "Your answers · Change" line. They replace the old "Find my
  options" form, the "You" chips and the branch chips; percentile and JEE estimates now go
  through `/estimate`.
- A landing page and one-question-per-screen onboarding for first-time visitors (#142).
  - `/welcome` has a hero with an illustration, "How it works", branch chips and the real data counts.
  - `/welcome/start` asks one question per screen: exam, merit number or percentile, category,
    gender, home university, special seats, minority community and branches of interest. JEE
    students skip the state-quota questions.
  - A "Checking the CAP lists" screen shows the real work (cutoff rows, the student's seat types,
    rounds, trends) for about 3 s while the search runs, then the results open filtered to the
    chosen branches, with a "Show all branches" chip.
- Minority community (#142): asked in onboarding and on My details, sent with every search, so
  minority (MI) seats at the student's community's colleges now appear. Before, every search sent
  "no minority community".
- Placement on the college page (#132): for each B.E./B.Tech graduating batch, graduates,
  students placed, median salary and higher studies, from the data the college submitted to NIRF.
  Why: students asked for placement data, and NIRF's is the only source with the same fields
  for every college, including median salary rather than the "highest package".
  - Source: the NIRF data PDF on each college's own site (NIRF hosts only ranked colleges).
    The URLs were found by crawling the college sites and are listed in
    `packages/pipeline/data/placement-sources.json`.
  - `npm run placement -w @mhtcet/pipeline` downloads and parses them into
    `data/college-placement.json`. Per batch, the newest NIRF edition wins, and Engineering
    wins over University and Overall. Rows that can't be right (more placed than graduated)
    are skipped.
  - New `placement` table (migration 005), `placement: true` in the staging-load request, and
    `GET /api/colleges/:code/placement`.
  - Figures are self-reported; the card says so and links each source PDF.
- The college's own placement figures from its website (#132): the latest year's highest,
  average and median package and placement %, shown above the NIRF table as "College's own
  figures", marked unverified, with links to the pages they came from.
  - Crawled from each college's site (placement pages and PDFs) and read by code; each figure
    keeps the sentence it came from. Figures published only as images are not read.
  - Figures read by hand from a college's own documents, where the crawler could not read them,
    are kept in `packages/pipeline/data/placement-manual.json` and replace the crawled figures:
    COEP (images), VJTI and SPIT (tables) so far.

### Changed
- The landing page is the home page (`/`) for everyone, returning students included, with
  "Continue to my results". Find colleges moves to `/find` (old `/?merit=…` links redirect) and its
  large "Your merit, your options" header is replaced by a compact one.
- New "Calm blue" colours across the whole app (#142): blue `#2563EB` for actions, light blue tints,
  amber highlights, slate text `#1E293B` and no dark bands. The bottom compare bar is blue instead of navy.
- EWS seats only for Open-category students (#142): the option is hidden for reserved categories and
  the engine no longer adds EWS seats for them.
- College fees rebuilt from the live FRA "Fee Approved" engineering reports (#42). Why: the old
  file hard-coded the rows, labelled 2026-27 fees as 2025-26, and kept four government-college
  entries (COEP, VJTI, ICT, SPCE) with order numbers no source states.
  - `npm run fees -w @mhtcet/pipeline` fetches (or reuses `data/raw/fra/`) the 2026-27 and
    2025-26 reports, matches by normalised code, then exact name, and writes `fees.json`
    with each entry's academic year, FRA id, status, meeting date and source URL.
  - 319 of 387 current colleges have fees (was 310); unmatched colleges are listed with a reason
    in `data/processed/2026/fees-match-report.json`. Government colleges have none.
  - The fee API returns the entry's own year instead of a fixed "2025-26".
  - `scripts/generate-fees.mjs` is replaced by the TypeScript pipeline command.
- Ask Compass: code now writes every cutoff number (accuracy plan, #20). Why: the eval showed
  the model's remaining errors were picking or copying the wrong row. RAG was considered and
  rejected (ADR-004).
  - **Placeholders:** the model writes `{{S3}}` and code puts in that row's exact value and
    citation.
  - **Precise `getCutoffs`:** it takes the college by name, initials or code, branch short forms
    (IT, ENTC, comp), seat type and round. It returns Round I when no round is given.
  - **Ambiguous names:** a name that matches several colleges returns an error listing them,
    instead of a guess.
  - **Prompt:** three short worked examples. gpt-oss now reasons at "medium".
  - **Eval:** it runs only the default model in CI, to fit Groq's free-tier daily limit. The
    cases use short branch names again, so none are skipped on the staging data.

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
- Seat matrix pipeline (#40, first half): `parse:seatmatrix` and `load:seatmatrix` read the CET
  Cell's Round I seat matrix for 2023–2026 into the new `seat_matrix` table (migration 003): seats
  per choice code per seat type, using the cutoff lists' seat-type codes, plus a `pool` column
  (state, minority, all-india, institute, supernumerary, common-reserved). Every branch's printed
  totals are checked before loading. `download --seat-matrix` fetches the PDF. Tested with
  synthetic fixtures and a load of all four years into a local Postgres.
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
