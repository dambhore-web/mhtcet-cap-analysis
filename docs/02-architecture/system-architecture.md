# System architecture

Status: target design (ADR-002, ADR-005). Only `src/pdf.ts` exists in TypeScript today.

## System context
```mermaid
flowchart LR
  U[Candidate / parent] -->|browser, phone| APP[CAP Cutoffs product]
  APP -->|model calls| LLM[LLM provider<br/>DECISION REQUIRED]
  APP -->|payments| PAY[Payment provider<br/>DECISION REQUIRED]
  APP -->|sign-in| AUTH[Auth provider<br/>DECISION REQUIRED]
  OP[Operator] -->|runs pipeline| PIPE[Offline pipeline]
  PIPE -->|downloads PDFs| CET[CET Cell public sites]
  PIPE -->|loads cutoffs| APP
```

## Containers
```mermaid
flowchart TB
  subgraph Offline["Operator machine (offline)"]
    PL[packages/pipeline<br/>download · parse · validate · summarise · load]
  end
  subgraph Online
    WEB[apps/web<br/>React + Vite SPA, plain CSS]
    API[apps/api<br/>TS API server + AI harness]
    DB[(Postgres<br/>cutoffs · users · plans · usage)]
  end
  CORE[[packages/core<br/>seat types · eligibility · rank finder]]
  PL --> CORE
  API --> CORE
  WEB --> CORE
  PL -->|upsert cutoffs| DB
  WEB -->|REST / JSON| API
  API --> DB
  API --> LLM[LLM provider]
  API --> PAY[Payment provider]
```

## Components
| Component | Responsibility | Notes |
|---|---|---|
| `packages/core` | Seat-type parsing, eligibility rules, rank-finder matching, percentile→rank lookup | Pure functions, no I/O. The only place admissions logic lives. |
| `packages/pipeline` | CLI stages; writes a run report | See `data-pipeline.md` |
| `apps/api` | Auth middleware, entitlement checks, REST routes, AI harness and tools, payment webhooks, usage metering | Framework `DECISION REQUIRED` (Hono recommended) |
| `apps/web` | Pages: rank finder, college, compare, assistant chat, account/billing | Plain CSS with design tokens; data through `src/lib/api.ts` |
| Postgres | Cutoff tables (read-mostly), users, subscriptions, usage | Supabase recommended, `DECISION REQUIRED` |

## Request flow: rank finder
```mermaid
sequenceDiagram
  participant W as Web
  participant A as API
  participant C as core
  participant D as DB
  W->>A: POST /api/rank-finder {merit, category, gender, flags}
  A->>A: validate schema, check entitlement
  A->>D: load cutoffs for year (cached)
  A->>C: findOptions(input, cutoffs)
  C-->>A: options with source rows
  A-->>W: 200 {options}
```

## AI request flow
```mermaid
sequenceDiagram
  participant W as Web
  participant H as API harness
  participant L as LLM
  participant T as Tools (core + DB)
  W->>H: POST /api/assistant {message}
  H->>H: auth, entitlement, usage budget check
  H->>H: assemble context (prompt vN, profile, trimmed history)
  H->>L: messages + tool schemas
  loop until final answer
    L-->>H: tool call
    H->>H: allow-list + schema-validate args
    H->>T: execute (read-only)
    T-->>H: result
    H->>L: tool result
  end
  L-->>H: answer
  H->>H: grounding check (numbers ⊆ tool results)
  H->>H: telemetry: model, prompt version, tokens, cost, latency, tools
  H-->>W: answer + citations
```

## Deployment
```mermaid
flowchart LR
  GH[GitHub main] -->|CI: typecheck, test, eval| CI[GitHub Actions]
  CI -->|deploy on approval| STG[Staging: api + web]
  STG -->|user approves| PROD[Production: api + web]
  STG --- SDB[(Staging DB)]
  PROD --- PDB[(Production DB)]
```
Hosting: Railway, web and API as two services per environment (#118). Details in `09-devops/`.

## Observability
Structured logs with request IDs from the API; AI telemetry per call; pipeline run reports.
See `10-observability/logging-metrics.md`.
