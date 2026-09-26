# Testing strategy

| Level | Tool | What | Phase |
|---|---|---|---|
| Unit | vitest | `packages/core`: seat-type grammar, eligibility, matching, percentile→rank. Parser functions on synthetic word-position fixtures | 3 |
| Parser validation | pipeline `validate` stage | Every branch's row count vs the printed `CAP Seats: N`, on real PDFs locally (not in CI, since the PDFs contain names) | 3, 4 |
| Parity | one-off script | TS parser output vs the Python baseline (5,468 / 240,114 rows, field-level) | 2 |
| Integration | vitest + test DB | API routes against a seeded DB; webhook signature handling | 6, 8 |
| End-to-end | Playwright | Rank finder form, college page, sign-in, checkout (payment provider test mode), assistant happy path | 6–8 |
| AI evaluation | eval runner | `05-ai/evaluation.md` | 7 |
| Security | CI + manual | `npm audit`; entitlement bypass tests; injection cases in evals; header/CSP checks | 3, 9 |
| Performance | k6 or autocannon (`ASSUMPTION`) | rank finder p95 < 1 s; assistant first token p95 < 3 s | 9 |

## Fixtures rule
Never commit real PDFs or parsed rows. Parser tests use hand-built word lists shaped like the
real layout, with made-up names and IDs.

## CI (Phase 3)
On every push: `npm ci` → `npm run typecheck` → `npm test` → `npm audit --audit-level=high`.
Eval job added in Phase 7 on changes under `apps/api/prompts/`, `apps/api/src/ai/` or tool code.
