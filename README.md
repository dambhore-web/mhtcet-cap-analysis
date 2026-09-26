# MHT-CET CAP Analysis

A paid web product, in development, that shows Maharashtra engineering aspirants which colleges
and branches their MHT-CET merit number or JEE percentile reached in past CAP rounds. It includes
an AI assistant grounded in the data. Built from the State CET Cell's published allotment and
merit lists.

- **Working on this repo (humans and AI agents):** read [AGENTS.md](AGENTS.md) first.
- **Where things stand:** [PROJECT_STATUS.md](PROJECT_STATUS.md)
- **Documentation:** [docs/README.md](docs/README.md)
- **Decisions:** [docs/DECISIONS.md](docs/DECISIONS.md) and [docs/adr/](docs/adr/)

## Current state
- COEP Technological University (16006), 2026 Rounds I–IV analysed: `dashboards/coep-2026.html`.
- The pipeline is being ported from Python to TypeScript (TASK-0002). Until that's done, the
  Python scripts in `src/cap/` are the only runnable pipeline; they'll be removed afterwards.

## Privacy
The source PDFs contain candidate names and application IDs. The parsers drop both, and raw PDFs
and row-level data are git-ignored. Only aggregated cutoffs are used in the product (ADR-003).
