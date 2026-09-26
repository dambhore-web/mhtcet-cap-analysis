# ADR-002: Monorepo with a shared domain core

- **Date:** 2026-09-27 · **Status:** Accepted
- **Context:** The pipeline, API, web app and AI tools all need seat-type parsing, eligibility
  rules and rank matching.
- **Problem:** If each part implements these separately, answers will drift between the rank
  finder, college pages and the assistant.
- **Options:** (a) separate repos; (b) one repo, npm workspaces, shared `packages/core`.
- **Decision:** (b). Layout: `packages/core`, `packages/pipeline`, `apps/api`, `apps/web`.
- **Consequences:** One source of truth; one CI; `core` must stay pure (no I/O) so it can run in
  the browser and on the server.
- **Rejected:** (a), because of versioning overhead for a small team.
- **Related:** ADR-001, ADR-004.
