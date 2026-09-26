# Tools registry

## Product tools (AG-001 Admissions Assistant)
All are read-only, run inside the API, and call `packages/core` plus the cutoff tables.
Arguments are validated against the schema before execution; results are size-capped.

| Tool | Purpose | Input | Output | Limits |
|---|---|---|---|---|
| `findOptions` | Rank finder | `{ year, merit? , jeePercentile?, category, gender, flags{ews,tfws,homeUniversity?}, filters{district?, university?, branchGroup?} }` | options: college, branch, seat type, status, closing merit, round, year | ≤ 50 options returned; one of merit / jeePercentile required |
| `getCutoffs` | Cutoffs for one college (optionally one branch/seat type) | `{ year, collegeCode, choiceCode?, seatType? }` | rows: branch, seat type, round, closing merit, min score | ≤ 200 rows |
| `explainSeatType` | Decode a seat-type code | `{ code }` | plain description from the glossary grammar | n/a |
| `searchColleges` | Find a college code by name, district or university | `{ query, year }` | ≤ 10 colleges | n/a |

| Property | Value for all product tools |
|---|---|
| Authentication | Runs as the signed-in user; no extra credentials |
| Permissions | Read cutoff tables only; no user tables except the caller's own profile (passed in, not queried) |
| Failure modes | Validation error (bad args) → returned to the model as a tool error; DB error → retry once, then tool error |
| Rate limits | Counted within the per-turn tool-call cap |
| Security | No free-form SQL; no network access; no file access |

## Pipeline tools (AG-002 Data Ingestion Agent)
AG-002 **writes** these npm scripts in `packages/pipeline` and then runs them through the shell.
None exist yet; the list below is the target set.

| Tool (npm script) | Purpose | Input | Output | Side effects |
|---|---|---|---|---|
| `discover` | List files the CET Cell site offers for a year | `--year` | `data/raw/<year>/manifest.json` | Reads public web pages |
| `download` | Fetch files in the manifest that are new or changed | `--year [--only cutoffs\|allotment\|merit]` | PDFs under `data/raw/<year>/` | Public downloads, ≥ 1 s apart, cached |
| `parse:cutoffs` | Official cutoff lists → rows | `--year` | `data/processed/cutoffs_<year>.ndjson` | Local files |
| `parse:allotment` | Allotment lists → seat-holder rows (no names or IDs) | `--year [--codes]` | `data/processed/allotment_<year>.ndjson` | Local files |
| `parse:merit` | Merit lists → merit no, exam, percentile | `--year` | `data/processed/ai_merit_<year>.ndjson` | Local files |
| `validate` | All checks in AG-002 §Validation | `--year` | `reports/run-<timestamp>.json` | Local files |
| `summarize` | Cutoff summaries for validated colleges | `--year` | `data/processed/summary_<year>.json` | Local files |
| `migrate` | Apply DB schema migrations | `--env local\|staging\|production` | Tables | Additive only; production needs operator approval |
| `load` | Upsert validated data into a DB | `--year --env local\|staging\|production` | DB rows | local/staging automatic after all checks pass; **production needs operator approval** |

| Property | Value for all pipeline tools |
|---|---|
| Authentication | None for public downloads. `migrate` and `load` read `DATABASE_URL_<ENV>` from env vars; values are never printed or logged |
| Permissions | Downloads only from URLs listed in the manifest, which is built from the CET Cell domains `*.mahacet.org` and `cappublicdocs<year>.blob.core.windows.net` |
| Failure modes | Network errors → retry with backoff, then report; parse or validation failures → run report entries |
| Rate limits | 1 request at a time, ≥ 1 s apart |
| Security | Outputs checked for application IDs and names; hard stop if found |
