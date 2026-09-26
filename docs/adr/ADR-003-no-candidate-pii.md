# ADR-003: No candidate names or application IDs anywhere in the product

- **Date:** 2026-09-27 · **Status:** Accepted
- **Context:** CET Cell allotment and merit PDFs list candidate names and application IDs, mostly
  of minors.
- **Problem:** Storing or publishing them adds privacy and legal risk and gives users nothing
  they need.
- **Decision:** Parsers drop names and IDs at read time. Raw PDFs stay on the operator's machine,
  git-ignored. Only merit, score, gender, category and seat type are kept in row data, and only
  aggregates reach the database. Test fixtures are synthetic.
- **Consequences:** We can't de-duplicate candidates across rounds by ID. Turnover analysis keys
  on section + merit number instead, which is unique within a merit list.
- **Rejected:** Hashing IDs, since it's still personal data and isn't needed.
- **Related:** `07-security/data-protection.md`, threat T1.
