# Agent registry

| ID | Agent | Purpose | Runs in | Tools | Class of actions | Spec |
|---|---|---|---|---|---|---|
| AG-001 | Admissions Assistant | Answer users' cutoff questions in plain language, grounded in data | Product API (`apps/api`) | `findOptions`, `getCutoffs`, `explainSeatType`, `searchColleges` | READ / ANALYZE only | [AG-001](AG-001-admissions-assistant.md) |
| AG-002 | Data Ingestion Agent | Build the data layer: study the sources, write the extraction code, run it, validate, load into the DB. Runs at the start and when new data or a new layout appears | Claude Code subagent (`.claude/agents/data-ingestion.md`) | Web fetch, shell, file read/write, the pipeline it builds, DB load | Build, run, validate, load to dev/staging automatic; production load, push and merge need operator approval | [AG-002](AG-002-data-ingestion-agent.md) |

Rule: add an agent only when reasoning or orchestration adds value that plain code doesn't.
Numbers are always produced by code, never by an agent.
