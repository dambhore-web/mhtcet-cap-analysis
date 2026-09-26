# ADR-001: TypeScript only

- **Date:** 2026-09-27 · **Status:** Accepted
- **Context:** The first pipeline was written in Python (PyMuPDF, pandas). The product will have a
  TypeScript web app and API.
- **Problem:** Two languages double the tooling, CI and skills needed, and admissions logic would
  be written twice.
- **Options:** (a) keep Python for the pipeline and use TS for the app; (b) TypeScript everywhere.
- **Decision:** (b), at the owner's request. PDF parsing uses `pdfjs-dist`.
- **Consequences:** One language, and `packages/core` is shared by pipeline, API and web. pdf.js
  word positions were checked against PyMuPDF on COEP page 1 (within 1–3 pt). Merit-list parse
  speed is not yet measured.
- **Rejected:** (a), because of duplicated logic and tooling.
- **Related:** `packages/pipeline`, `packages/core`, ADR-002.
