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
- **Related:** `05-ai/ai-architecture.md`, AG-001.
