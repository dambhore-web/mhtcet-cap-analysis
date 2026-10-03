# AGENTS.md — operating manual for AI agents

Every AI agent (Claude Code or otherwise) working in this repository follows these rules.
Humans should too. If a rule blocks you, stop and ask; don't work around it.

## Project purpose
A paid web product that helps Maharashtra engineering aspirants and their families understand
MHT-CET CAP admission cutoffs: which college, branch and seat type a given merit number or JEE
percentile reached in past rounds. It is built from the State CET Cell's published allotment and
merit lists. See `docs/00-project/vision.md`.

## Architecture principles
- **One source of truth for admissions logic.** Seat-type grammar, eligibility rules and the rank
  finder live in `packages/core` (pure, deterministic, unit-tested). The API, web app and AI
  assistant all call it. Never re-implement eligibility logic elsewhere.
- **Numbers come from data, never from a model.** Any cutoff, rank or percentile shown to a user
  must trace to a row in the cutoff tables. The AI assistant gets numbers only through tools.
- **Offline pipeline, online app.** PDFs are downloaded and parsed offline; only aggregated
  cutoffs reach the database and the app.
- **Record decisions.** Significant architecture choices get an ADR in `docs/adr/`. Don't change
  a decided ADR silently; supersede it with a new one.

## Repository structure (target, see ADR-002)
| Path | What |
|---|---|
| `packages/core` | Domain logic: seat types, eligibility, rank finder |
| `packages/pipeline` | Download → parse → validate → summarise → load |
| `apps/api` | TypeScript API server, AI harness, prompts |
| `apps/web` | React + Vite app, plain CSS with design tokens |
| `docs/` | Project documentation (index: `docs/README.md`) |
| `tasks/` | One file per significant task (`TASK-NNNN.md`) |
| `.claude/agents/` | Claude Code subagents, e.g. `data-ingestion.md` (AG-002). Registry: `docs/06-agents/agent-registry.md` |
| `data/` | Local only, git-ignored |


## Coding conventions
- **TypeScript only**, `strict` mode, ES modules, Node 24 (ADR-001). No Python, no plain JS files.
- Names: `camelCase` functions and variables, `PascalCase` types and React components,
  `kebab-case` file names for docs, `camelCase.ts` for source files.
- Prefer pure functions; keep I/O at the edges (CLI entry points, API handlers).
- No `any` without a comment saying why.
- Web: plain CSS using the design tokens in `apps/web/src/tokens.css` (no Tailwind); API calls go
  through `apps/web/src/lib/api.ts`. English only at launch (NFR-005).
- Copy: compare a merit number with a closing merit number only as **better** or **worse** (a
  smaller number is better), through `describeMeritGap()` in `apps/web/src/lib/meritGap.ts`:
  "1,550 better", "Your merit number 12,450 is 3,950 worse than last year's closing (8,500)."
  Never "above", "below", "to spare", "short" or "safe"; the difference counts candidates, not
  seats (#140).

## Data and privacy rules (non-negotiable, ADR-003)
- **Never commit** PDFs, row-level CSV/NDJSON, or anything under `data/`.
- **Never store or display candidate names or application IDs.** Parsers drop them at read time.
- Test fixtures use synthetic word positions with fake names, never real PDFs.
- Users' own profile values (rank, category, gender) are personal data: don't log them and don't
  send them to the LLM beyond what the current question needs.

## Pipeline rules
- A parser change is done only when every branch in every sample college passes the check
  against the printed `CAP Seats: N` (see `docs/02-architecture/data-pipeline.md`).
- Download politely: cache files, one request at a time, at least 1 second apart.

## API rules
- Validate every request body and query at the boundary with a schema.
- Every route handles errors and returns the shape in `docs/04-api/error-model.md`; never leak
  stack traces or internal IDs.
- Paid features check entitlement on the server, never only in the UI.

## AI / LLM rules
- Prompts are versioned files under `apps/api/prompts/`; a prompt change bumps its version.
- A prompt or model change must pass the evaluation set (`docs/05-ai/evaluation.md`) first.
- Tools are read-only and allow-listed; inputs are schema-validated before execution.
- Log model, prompt version, tokens, cost, latency and tool names per call. Never log message
  content containing user profile values.

## Logging and observability
- Log prefix `[AREA] message`, e.g. `[PARSE]`, `[API]`, `[AI]`, `[PAY]`.
- Never log secrets, tokens or personal data; log `Boolean(value)` instead.

## Git rules
- One branch per task: `feat/`, `fix/`, `docs/`, `chore/`, `data/`, `ai/` + short description.
- Conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `data:`, `ai:`,
  `security:`), with why, what changed and how it was tested.
- **No push to `main` and no deploy without the user's explicit OK in that conversation.**
- Never commit secrets; `.env.example` lists every variable with a placeholder.

## Documentation rules
- Write only what is decided or observed. Mark gaps `UNKNOWN`, open choices
  `DECISION REQUIRED`, and guesses `ASSUMPTION`. Never invent requirements, prices, users or APIs.
- Update `PROJECT_STATUS.md` and `CHANGELOG.md` after significant work.
- If a change affects architecture, requirements, data model, API, prompts or tools, update the
  matching doc in the same change.

## Definition of Done
A change is done when: acceptance criteria are met · `npm run typecheck` and `npm test` pass ·
tests were added for new logic · docs, ADRs and `PROJECT_STATUS.md` are updated · no personal data
or secrets are exposed · for AI changes, the eval set passes · for parser changes, the CAP Seats
check passes on all samples.

## Progress reports
Report in this shape: **Current Phase · Completed · In Progress · Decisions Required · Risks ·
Next Actions.**
