# Deployment

Hosting decision (#118, `DECISIONS.md`): **the web app and the API both run on Railway**, as two
services per environment. The earlier Vercel deployment of the web app is retired.

## Railway services

| Service | Root directory | Config file path | Serves |
|---|---|---|---|
| `compass-api` | `/` (repo root) | `apps/api/railway.toml` | Hono API on `$PORT`, health check `/api/health` |
| `compass-web` | `/` (repo root) | `apps/web/railway.toml` | Built SPA from `apps/web/dist` via `serve` |

Both services build from the **repo root**, not from their app folder: the web app and the API
both import `packages/core`, which a service rooted at `apps/web` or `apps/api` cannot see. Each
config sets `watchPatterns`, so a change only redeploys the service it touches.

### Setup steps
1. Create two Railway projects: `compass-staging` and `compass-production`.
2. In each project, add two services from this GitHub repo. For each service, open
   **Settings**:
   - **Root directory:** leave empty (repo root).
   - **Config file path:** `apps/api/railway.toml` or `apps/web/railway.toml`.
   - **Branch:** the branch that deploys to this environment (`DECISION REQUIRED`, see
     `environments.md`).
3. Set the variables below. Deploy the API first, then copy its public URL into the web
   service's `VITE_API_URL` and redeploy the web service (Vite reads it at build time).
4. Node: the root `package.json` requires Node 22.12 or later (`engines`). If a build picks an
   older Node, set `NIXPACKS_NODE_VERSION=22` on the service.

### Variables: API service
| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string for this environment. Use a SELECT-only role (see `docs/07-security/security-review-2026-09.md`); the API also forces read-only sessions |
| `GROQ_API_KEY` | Ask Compass model key |
| `GROQ_MODEL` | Optional; default `openai/gpt-oss-120b` |
| `CORS_ORIGINS` | **Set in staging and production**: the web app's origin(s), comma-separated, e.g. `https://compass-web-staging.up.railway.app`. Unset allows any origin (local dev only) |
| `TRUSTED_PROXY_HOPS` | Optional; default `1` (Railway's edge). Proxies in front of the API that append to `X-Forwarded-For`; used for per-IP rate limits |
| `TRUST_CLOUDFLARE` | Optional; `1` only if Cloudflare sits in front of the API (then `CF-Connecting-IP` is trusted) |
| `RATE_LIMITS` | Leave unset in deployed environments. `off` disables the per-IP limits (load and end-to-end tests only) |
| `PORT` | Set automatically by Railway |

### Variables: web service
| Variable | Description |
|---|---|
| `VITE_API_URL` | Public URL of this environment's API service, e.g. `https://compass-api-staging.up.railway.app`. Also written into the Content Security Policy (`connect-src`) at build time by `scripts/write-serve-headers.mjs` |

### Retiring Vercel
The Vercel project still builds `main` and posts preview comments on PRs. Once the Railway web
service is live, the owner removes it: in Vercel, delete the project (or disconnect its Git
repository), and remove the Vercel app from the repo's GitHub integrations if nothing else uses
it. No code in this repo depends on Vercel.

---

## Target flow

1. Work on a task branch → pull request → CI green.
2. Merge → deploy to **staging** automatically (`DECISION REQUIRED`: merge target branch name).
3. Verify on staging (smoke checklist, created in Phase 6).
4. **The user approves** → promote the same build to **production**.
5. Roll back by redeploying the previous build; DB migrations are additive only (new columns with
   defaults), so the previous build stays compatible.

Data releases (new year, new round) follow the same path: pipeline run → run report reviewed →
load to staging → check → load to production.
