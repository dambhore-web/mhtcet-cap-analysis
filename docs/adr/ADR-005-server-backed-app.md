# ADR-005: Server-backed web app, not a static site

- **Date:** 2026-09-27 · **Status:** Accepted
- **Context:** The owner chose a paid product with an LLM assistant. The COEP prototype is a
  static page with embedded data.
- **Problem:** A static site can't keep an LLM API key secret, enforce paid plans or receive
  payment webhooks, and embedded data can be copied freely.
- **Decision:** A TypeScript API server with a Postgres database, serving a React SPA. Cutoff data
  is served per request, with entitlement checks.
- **Consequences:** Hosting, a DB, auth and secrets management are needed. Provider choices are
  open: API framework, DB/auth, payments, hosting (`DECISION REQUIRED`, see `DECISIONS.md`).
- **Rejected:** Static site + serverless function for AI only. Paid data would still be public.
- **Related:** `02-architecture/system-architecture.md`.
