# ADR-007: Multi-authority data model (all-India ready)

- **Date:** 2026-09-27 · **Status:** Accepted
- **Context:** The owner plans to expand Compass beyond Maharashtra to other states' counselling
  (e.g. KCET, TNEA, JoSAA/CSAB). Each authority has its own exams, lists, seat types, quotas and
  Home University rules.
- **Problem:** A Maharashtra-only schema would need key changes and data migration when the
  second authority is added.
- **Options:** (a) Maharashtra-only now, refactor later; (b) add `authority` and `exam` to every
  record and key now, and keep eligibility rules per authority.
- **Decision:** (b). Every `college`, `branch`, `cutoff` and `merit_lookup` row, and the core
  types, carry `authority` (current value `MH-CET-CELL`) and `exam` (`MHT-CET`, `JEE`, …).
  `packages/core/src/authority.ts` registers a rule set per authority: seat-type grammar now,
  eligibility rules next. Only Maharashtra is built; other states come later.
- **Consequences:** Tiny cost now (two columns, part of every key). Adding an authority means a
  new rule set plus its parsers, with no schema redesign. The UI and AI assistant must always show
  which authority and exam a number belongs to.
- **Rejected:** (a), because retrofitting keys after data is loaded risks breaking IDs and links.
- **Related:** ADR-002, `03-domain/data-model.md`, `migrations/001_initial_schema.sql`.
