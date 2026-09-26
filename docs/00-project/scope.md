# Scope

## In scope
- MHT-CET CAP first-year engineering (4-year B.E./B.Tech and integrated M.E./M.Tech) in Maharashtra.
- Data: CAP allotment lists per college and round, State and All India merit lists, from the
  State CET Cell's public sites.
- Years: 2026 first, then earlier years (Phase 10). Which earlier years are available: `UNKNOWN`.
- Product: rank finder, college pages, comparisons, AI assistant, accounts, paid plans.

## Out of scope (for now)
| Item | Why |
|---|---|
| Other courses (pharmacy, MBA, direct second year, etc.) | Different lists and rules; revisit after launch |
| Institute-level and against-CAP admissions | Not in the CAP allotment lists |
| Predicting next year's cutoffs | Not built until a forecasting method is designed and evaluated; until then past cutoffs are shown as history only |
| Filling or submitting option forms for users | The product informs; it doesn't act on the CET portal |

## Parts of the engineering framework that don't apply
The project follows a trimmed version of the master engineering prompt. These areas are `N/A`
and have no separate docs:
| Area | Why |
|---|---|
| RAG, embeddings, vector store | The data is structured tables; the assistant uses tools, not retrieval (ADR-004) |
| Multi-agent hierarchy, agent memory beyond the conversation | One assistant agent is enough; the saved user profile is ordinary account data |
| Messaging / queues | No async workloads beyond the offline pipeline. Revisit if AI calls need background jobs |
| QA environment separate from staging | Small team; local → staging → production is enough |
| Distributed tracing | Single API service; request IDs in logs are enough at launch |
