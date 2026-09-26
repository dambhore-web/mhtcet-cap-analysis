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
- 2026 data layer built by AG-002 (TASK-0002): official cutoff lists for all 387 colleges, rounds
  I–IV (state, All India, diploma), the institute list and the All India merit list are parsed,
  validated and loaded into the Supabase **staging** database.
- COEP Technological University (16006), 2026 Rounds I–IV analysed: `dashboards/coep-2026.html`.

## Quick start (Node 24)
```sh
npm install
npm run typecheck && npm test          # strict TypeScript + vitest (synthetic fixtures)
npm run discover -- 2026               # data/raw/2026/manifest.json
npm run download -- 2026 --colleges 16006 --merit PCMAI
npm run parse:institutes && npm run parse:cutoffs && npm run parse:allotment && npm run parse:merit
npm run validate                       # writes reports/run-<ts>.json
npm run migrate && npm run load        # staging only; needs DATABASE_URL_STAGING in .env
```
Pipeline details: [docs/02-architecture/data-pipeline.md](docs/02-architecture/data-pipeline.md).

## Privacy
The source PDFs contain candidate names and application IDs. The parsers drop both, and raw PDFs
and row-level data are git-ignored. Only aggregated cutoffs are used in the product (ADR-003).
