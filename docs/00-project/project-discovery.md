# Project discovery (Phase 0)

_Date: 2026-09-27. Snapshot of the repository before the engineering framework was applied._

## Current architecture
A single-purpose offline analysis: download CET Cell PDFs → parse with Python (PyMuPDF) → CSV →
ad-hoc summary scripts (session scratchpad, not in the repo) → one static HTML dashboard.
No server, database, authentication or deployment.

## Technology stack
| Part | Found |
|---|---|
| Parsing | Python 3.11, PyMuPDF, pandas (`src/cap/*.py`, committed) |
| TS port (uncommitted) | Node 24, TypeScript, `tsx`, `pdfjs-dist` 4.10.38 (`src/pdf.ts`) |
| Dashboard | Hand-written HTML/CSS/JS with embedded JSON; published as a private claude.ai artifact |
| Source control | Private GitHub repo `dambhore-web/mhtcet-cap-analysis`, 1 commit on `main` |

## Existing modules
| File | Does |
|---|---|
| `src/cap/download.py` | Fetches allotment PDFs by college code and round, and the All India merit list |
| `src/cap/parse_allotment.py` | Allotment PDF → one row per seat holder (round, branch, section, merit, score, gender, category, seat type) |
| `src/cap/parse_merit.py` | All India merit list → merit no, exam, percentile |
| `src/pdf.ts` | pdf.js reader yielding words with top-origin coordinates |
| `dashboards/coep-2026.html` | COEP 2026 dashboard: cutoffs, rank checker, All India table, turnover |

## Data found
- Local only: 4 COEP 2026 allotment PDFs (2.5 MB), `data/processed/allotment_2026.csv` (5,468 rows).
- Session scratchpad only: 2026 All India (PCM) merit list (75 MB, 7,278 pages) and its parsed CSV
  (240,114 of 240,141 rows). JEE-ranked candidates hold merit numbers 1–98,360.
- Verified: all 948 COEP All India seat rows match the merit list on merit number and percentile.

## Not present
Tests · CI/CD · Docker · infrastructure config · auth · API · database · payments · logging ·
monitoring · LLM integration · agents · prompts · skills · MCP · `AGENTS.md` / `CLAUDE.md`.

## Technical debt
- Repo is half Python (committed) and half TypeScript (uncommitted).
- `.gitignore` did not list `node_modules/` (fixed in Phase 1).
- COEP dashboard data can't be regenerated from repo code.
- Parser tuned to one autonomous college: fixed column x-ranges; only State Level and All India
  sections tested; no check against the printed `CAP Seats: N` per branch.
- One COEP Round I row parsed without a seat type.

## Risks
| Risk | Notes |
|---|---|
| Commercial reuse of CET Cell data | Terms `UNKNOWN`. Top risk for a paid product. See `07-security/legal-open-items.md` |
| Minors' personal data in source PDFs | Names and application IDs dropped at parse time; raw data git-ignored |
| Parser fragility across ~350 colleges | Mitigation: CAP Seats check + run report (Phase 4–5) |
| Source URL changes year to year | URL patterns are year-parameterised; verify each year |
| pdf.js speed on the 7,278-page merit list | `UNKNOWN` until measured |

## Missing components (for the target product)
Monorepo packages, domain core, API, database, auth, payments, web app, AI harness, evaluation
set, CI, environments, observability. Planned in `PROJECT_STATUS.md`.

## Recommended improvements
Captured as phases 1–10 in `PROJECT_STATUS.md` and ADR-001 to ADR-005.
