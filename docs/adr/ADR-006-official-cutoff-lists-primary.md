# ADR-006: Official cutoff lists are the primary cutoff source; an agent runs ingestion

- **Date:** 2026-09-27 · **Status:** Accepted, pending owner review
- **Context:** The plan was to compute cutoffs by parsing 1,548 institute-wise allotment PDFs
  (387 colleges × 4 rounds, ~1 GB). The CET Cell also publishes official cutoff lists per round
  (state + minority, All India, diploma): about 9 PDFs per year covering every college.
- **Evidence:** COEP 2026 Round I cutoffs computed from allotment lists match the official list
  exactly, across every value checked (Civil GOPENS 4,148, GSCS 13,137, GOBCS 5,736, TFWS 3,746;
  AI & ML GOPENS 365, EWS 1,261; Instrumentation GOPENS 1,743).
- **Decision:**
  1. Official cutoff lists are the primary source for closing merit and percentile.
  2. Allotment lists are secondary: opening merit, seats filled, gender split, turnover, and a
     cross-check of the official cutoffs.
  3. AG-002, the Data Ingestion Agent (a Claude Code subagent), builds the data layer: it studies
     the sources, writes the TypeScript extraction code with tests and migrations, runs it,
     validates the output and loads it into the database. It runs at the start and again when
     new data or layouts appear. Every value comes from that code, never typed in by the agent.
- **Consequences:** Phases 4–5 get smaller: one cutoff-list parser covers all colleges, including
  Home University sections. The allotment parser still needs hardening for the extra features.
  A new validation check compares the two sources.
- **Rejected:** Allotment lists only (1,548 files, more layout risk); an LLM reading PDFs directly
  (not reproducible, error-prone on numbers).
- **Related:** ADR-003, ADR-004, `06-agents/AG-002-data-ingestion-agent.md`, `02-architecture/data-pipeline.md`.
