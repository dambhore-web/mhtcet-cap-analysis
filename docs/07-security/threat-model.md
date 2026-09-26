# Threat model

Scope: the target product (web, API, DB, AI harness, payments) and the offline pipeline.

| # | Threat | Asset | Mitigation | Phase |
|---|---|---|---|---|
| T1 | Candidate names or IDs leak from source PDFs | Minors' personal data | Dropped at parse time; raw data git-ignored and never uploaded (ADR-003) | done / 2 |
| T2 | Paid data scraped via public endpoints | Revenue | Entitlement checks server-side; pagination caps; rate limits | 6, 8 |
| T3 | Entitlement bypass by editing the client | Revenue | All checks in the API | 6, 8 |
| T4 | Spoofed payment webhooks | Revenue | Verify provider signature; idempotent processing by event ID | 8 |
| T5 | Prompt injection makes the assistant misbehave | Trust, cost | Read-only allow-listed tools; schema validation; grounding check; adversarial evals | 7 |
| T6 | Assistant used as a free general chatbot | Cost | Scope refusal; per-user allowance; output token caps | 7 |
| T7 | Users' profile data (rank, category, gender) exposed | Personal data | Row-level access to own profile only; not logged; minimal fields to the LLM | 6 |
| T8 | Secrets leaked (LLM key, payment key, DB key) | Accounts, money | Env vars only; never logged; `.env` git-ignored; separate keys per environment | 6 |
| T9 | Account takeover | User data | Managed auth provider; no custom password storage | 6 |
| T10 | XSS via college/branch names or assistant output | Users | React escaping; no raw HTML from data or model; CSP | 6, 7 |
| T11 | Supply-chain compromise via npm packages | Everything | Lockfile; pinned versions; `npm audit` in CI; few dependencies | 3 |
| T12 | SSRF / arbitrary downloads | Server | Download URLs built only from fixed patterns + validated codes; pipeline runs offline, not in the API | 2 |
| T13 | Wrong data published (parser error) | Trust | CAP Seats validation; only validated colleges loaded; spot checks against PDFs | 4, 5 |
