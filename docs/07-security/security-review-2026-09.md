# Security review — September 2026 (#25)

Scope: the API (`apps/api`), the web app (`apps/web`), the data pipeline and its staging workflow,
the repository and its history, and dependencies, as on `Dev` at 28 Sep 2026. Sign-in (#15) and
payments (#21) are not built yet, so entitlement and webhook checks are deferred to them.

## Summary

| Result | Count |
|---|---|
| Findings fixed in this change | 11 |
| Checked and clean | 8 |
| Open: owner action (settings, not code) | 3 |
| Open: later, with sign-in / payments / Groq tier | 5 |

## Findings fixed

| # | Severity | Finding | Fix |
|---|---|---|---|
| S1 | High | **Rate-limit bypass.** `clientIp()` took the *first* `X-Forwarded-For` entry, which the client controls: any caller could send a new made-up IP per request and never hit the Ask Compass limit (20 questions/IP/hour). | The client IP is now the entry added by our own proxy (the last `TRUSTED_PROXY_HOPS`, default 1 for Railway). `CF-Connecting-IP` is trusted only with `TRUST_CLOUDFLARE=1`. Tested with forged headers. |
| S2 | High | **No limits on the public data routes.** Rank finder and simulator return the whole state's options (~0.6 MB) per call with no budget, so the data could be bulk-scraped (threat T2) and the server flooded. | Per-IP budgets: searches (`/api/rank-finder`, `/api/simulate`) 60/min; every `/api/*` route 600/min; `429` with `Retry-After`. Far above normal use. `RATE_LIMITS=off` only for load/e2e tests. |
| S3 | Medium | **No request size limit.** Any route accepted arbitrarily large bodies. | 64 KB limit on `/api/*` (`413 payload_too_large`); the assistant's longest valid history is ~24 KB. |
| S4 | Medium | **Assistant profile unvalidated and written into the model prompt.** `homeUniversity` (free text), `category`, `gender` and `merit` went straight into the system prompt, a prompt-injection channel. | Zod schema: merit integer 1–1,000,000; category from the fixed list; gender M/F; home university plain text ≤120 characters with no newlines or markup. Otherwise `400`. |
| S5 | Medium | **Assistant history only loosely checked.** | Schema: 1–50 messages, roles `user`/`assistant` only (a `system` role is rejected), content ≤20,000 characters; the last 12 are kept, each cut to 2,000. |
| S6 | Medium | **No security headers on the web app.** No CSP, HSTS, framing or MIME-sniffing protection. | `scripts/write-serve-headers.mjs` writes `dist/serve.json` at build: CSP (`script-src 'self'`, `connect-src` = the API origin from `VITE_API_URL`, `frame-ancestors 'none'`, `object-src 'none'`), HSTS (1 year), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP. Checked in Chromium on Find, college, branch-trend, fee and Ask pages: no CSP violations. |
| S7 | Low | **No security headers on API responses.** | Hono `secureHeaders`: `nosniff`, framing blocked, HSTS, `default-src 'none'` CSP, no referrer. |
| S8 | Medium | **CORS allowed every origin**, which becomes a problem once sign-in adds credentials. | `CORS_ORIGINS` (comma-separated). Unset still means `*` for local dev; **must be set on Railway** (see O1). |
| S9 | Medium | **API database sessions could write.** The pool was "read-only" by comment only, and `DATABASE_URL` is typically a user with write access. | Every session starts with `default_transaction_read_only=on` (start-up option): INSERT/DELETE are refused. Verified on Postgres 16. A SELECT-only role is still recommended (O2). |
| S10 | Low | **Client `X-Request-Id` echoed and logged unchecked** (log injection). | Only `[A-Za-z0-9-]{1,64}` is kept; anything else gets a fresh UUID. |
| S11 | Low | **CI jobs ran with the repository's default token permissions.** | `permissions: contents: read` on `ci.yml` and `staging-load.yml`. |

## Checked and clean

| Check | Result |
|---|---|
| `npm audit` (all workspaces, incl. dev) | 0 vulnerabilities |
| Secrets in the repository | All 126 commits scanned for database URLs, Groq/OpenAI/Razorpay keys, JWTs, AWS keys and private keys. One hit: a documentation example with a placeholder password and host. `.env*` is git-ignored (only `.env.example` tracked). |
| SQL injection | Every query is parameterised; no SQL is built from strings. Numeric inputs are parsed and range-checked. |
| XSS | No `dangerouslySetInnerHTML`, `innerHTML` or `eval`; React escapes data and model output; the new CSP blocks inline scripts. |
| Personal data in logs | Request logs hold method, path (no query string), status and duration. Assistant messages, profiles and merit numbers are never logged. |
| Personal data from CET Cell PDFs | Raw PDFs are git-ignored; merit lists keep only merit, exam and score; loaders refuse rows that look like application IDs. The allotment PDFs downloaded during the parked crawl (#11) were deleted. |
| Assistant tools | Read-only, allow-listed functions over the in-memory data; no network, file or database writes. Answers pass the grounding and citation checks. |
| Pipeline downloads | Hosts are allow-listed in `packages/pipeline/src/http.ts` (CET Cell, its Azure blob store, FRA); URLs come from fixed patterns. |

## Open: owner action (settings)

| # | Severity | What to do |
|---|---|---|
| O1 | Medium | On Railway, set **`CORS_ORIGINS`** on each API service to that environment's web URL. |
| O2 | Medium | Give the API a **SELECT-only database role** in staging and production, and use it in the API's `DATABASE_URL` (the loaders keep the owner role). SQL for the Supabase SQL editor is below. |
| O3 | Medium | **Verify the database's TLS certificate.** The API and pipeline connect with `rejectUnauthorized: false`. Supabase publishes its CA certificate (Project Settings → Database → SSL); once it is added as a secret, set `ssl: { ca }` and turn verification on. |

```sql
-- Supabase SQL editor, once per environment. Then use this user in the API service's DATABASE_URL.
create role compass_api login password '<generate a strong password>';
grant usage on schema public to compass_api;
grant select on all tables in schema public to compass_api;
alter default privileges in schema public grant select on tables to compass_api;
alter role compass_api set default_transaction_read_only = on;
```

## Open: later

| # | Item | When |
|---|---|---|
| L1 | Prompt-injection eval cases EV-045–EV-052 exist but could not be run: the Groq free tier's daily token limit cuts the eval short. | When the Groq Developer tier is enabled (#20). |
| L2 | Entitlement bypass tests, webhook signature checks and per-user assistant limits (the issue's checklist items for paid routes). | With sign-in (#15) and payments (#21). Until then the IP limit is the only assistant budget. |
| L3 | Rate-limit counters are in memory, per instance. | If the API runs on more than one instance, move them to a shared store. |
| L4 | CSP allows inline styles (`style-src 'unsafe-inline'`) for component style attributes. Inline scripts stay blocked. | Low; revisit if a nonce-based setup is added. |
| L5 | The staging-load workflow can be triggered by anyone with write access and uses the staging database secret. | Keep production credentials out of workflows; use a protected GitHub Environment with required reviewers before any production load job. |

## Checklist from #25

| Item | Status |
|---|---|
| `npm audit` clean | ✅ 0 vulnerabilities |
| Entitlement bypass → 403 | ⏳ No paid routes yet (#15, #21) |
| SQL injection | ✅ Parameterised queries only; malformed input rejected by schemas |
| Prompt injection eval cases | ⏳ Cases exist; blocked by Groq quota (L1). Input channels hardened (S4, S5) |
| No PII in logs | ✅ |
| No secrets in repo | ✅ |
| HTTPS only; HSTS | ✅ HSTS on web and API; CSP `upgrade-insecure-requests` |
| CSP blocks inline scripts | ✅ `script-src 'self'` |
| Rate limits on public routes; per-user on the assistant | ✅ Per-IP on all routes (S1, S2); ⏳ per-user after sign-in |
