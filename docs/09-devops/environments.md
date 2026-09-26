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
- App hosting provider: `DECISION REQUIRED` (Railway recommended).

## Variables
| Variable | Used by | Where to get it | Environments |
|---|---|---|---|
| `DATABASE_URL_STAGING` | pipeline `migrate`, `load` (AG-002) | Supabase staging project → Connect → connection string (session pooler, port 5432) | local `.env` |
| `DATABASE_URL_PRODUCTION` | pipeline `migrate`, `load` (production, with approval) | Supabase production project, same place | local `.env`, only when a production load is approved |

Never print, log or commit these values. `.env` is git-ignored.
