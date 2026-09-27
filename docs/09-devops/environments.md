# Environments

| Env | Purpose | Data | Deployed by |
|---|---|---|---|
| local | Development and pipeline runs | Local PDFs; loads go to the staging DB | developer / AG-002 |
| staging | QA before production; payment provider in test mode | Supabase staging project | AG-002 loads automatically after all checks pass; app deploys via CI (`DECISION REQUIRED` which branch) |
| production | Paying users | Supabase production project | Manual, after the user approves |

Rules:
- Configuration comes from environment variables only; nothing environment-specific in code.
- Each environment has its own Supabase project, LLM key, payment keys and auth settings.
- Every variable is listed in `.env.example` with a placeholder and documented below.
- App hosting: Railway, with the web app and the API as two services per environment
  (`DECISIONS.md`, #118). Setup: `deployment.md`.

## Variables
| Variable | Used by | Where to get it | Environments |
|---|---|---|---|
| `DATABASE_URL_STAGING` | pipeline `migrate`, `load` (AG-002) | Supabase staging project → Connect → connection string (session pooler, port 5432) | local `.env` |
| `DATABASE_URL_PRODUCTION` | pipeline `migrate`, `load` (production, with approval) | Supabase production project, same place | local `.env`, only when a production load is approved |

| `DATABASE_URL` | API at runtime | Same Supabase connection string as above, for that environment | Railway API service |
| `GROQ_API_KEY` | API, Ask Compass | groq.com console | Railway API service |
| `GROQ_MODEL` | API, Ask Compass (optional; default `llama-3.3-70b-versatile`) | — | Railway API service |
| `VITE_API_URL` | Web, read at **build** time | The API service's public URL | Railway web service |

GitHub Actions repository secrets (Settings → Secrets and variables → Actions):

| Secret | Used by |
|---|---|
| `DATABASE_URL_STAGING` | `Playwright live smoke`, `Performance (staging data)` and `Assistant eval` jobs |
| `GROQ_API_KEY` | `Assistant eval` job and the assistant half of the performance job; both are skipped without it |

Never print, log or commit these values. `.env` is git-ignored.
