# ADR-004: The AI assistant uses tools over structured data, not RAG

- **Date:** 2026-09-27 · **Status:** Accepted
- **Context:** The owner wants an AI assistant from the start. The knowledge is tables of cutoffs.
- **Problem:** Answers must be numerically exact and traceable.
- **Options:** (a) RAG over text chunks of cutoff tables; (b) function/tool calling into `packages/core`.
- **Decision:** (b). The model interprets the question and explains; code computes every number.
  A grounding check rejects answers with numbers that aren't in the tool results.
- **Consequences:** No embeddings or vector store. The model must support tool calling well.
  The eval set measures tool-call accuracy.
- **Rejected:** (a), because retrieval of number tables invites model arithmetic and errors.
- **Update (28 Sep 2026):** the model no longer types cutoff numbers at all. It writes a row id
  in double braces (`{{S3}}`) and code puts in that row's exact value and citation
  (`apps/api/src/assistant/render.ts`). `getCutoffs` takes the college by name or initials,
  branch short forms, seat type and round, so the model states what was asked rather than
  picking a row out of many. Why: the first real eval runs showed the remaining errors were all
  the model picking or copying the wrong row. RAG was reconsidered and rejected again for the
  same reason as above: similarity search is weakest at choosing one exact row among
  near-identical ones.
- **Related:** `05-ai/ai-architecture.md`, AG-001.
