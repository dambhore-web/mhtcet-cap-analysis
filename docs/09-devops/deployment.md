# Deployment

Status: Railway configs added (PR #70 / issue #16). Two services per environment.

## Railway services

| Service | Directory | Config |
|---|---|---|
| `compass-api` | `apps/api` | `apps/api/railway.toml` |
| `compass-web` | `apps/web` | `apps/web/railway.toml` |

### Setup steps
1. Create two Railway projects: `compass-staging` and `compass-production`
2. In each project, add two services pointing to the repo:
   - **API service**: root dir = `apps/api`, env = see below
   - **Web service**: root dir = `apps/web`, env = `VITE_API_URL=<api-service-url>`
3. Connect a Supabase Postgres database to the API service
4. Set all required env vars (see below)

### Required environment variables — API service
| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string |
| `PORT` | Set automatically by Railway |

### Required environment variables — Web service
| Variable | Description |
|---|---|
| `VITE_API_URL` | Full URL of the deployed API service (e.g. `https://compass-api-staging.up.railway.app`) |

---

## Target flow (Phase 6 onward):

1. Work on a task branch → pull request → CI green.
2. Merge → deploy to **staging** automatically (`DECISION REQUIRED`: merge target branch name).
3. Verify on staging (smoke checklist, created in Phase 6).
4. **The user approves** → promote the same build to **production**.
5. Roll back by redeploying the previous build; DB migrations are additive only (new columns with
   defaults), so the previous build stays compatible.

Data releases (new year, new round) follow the same path: pipeline run → run report reviewed →
load to staging → check → load to production.
