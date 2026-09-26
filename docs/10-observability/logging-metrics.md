# Logging and metrics

## Logs
- Structured JSON lines with `requestId`, `area` (`[API]`, `[AI]`, `[PAY]`, `[PARSE]`…), level, message.
- Never logged: secrets, tokens, user profile values, message text containing them, payment details.

## Pipeline
Each run writes `reports/run-<timestamp>.json`: files downloaded or skipped, rows parsed per file,
CAP Seats check result per branch, failures. This is the pipeline's monitoring.

## API metrics
Request count, error rate by `category`, latency p50/p95 per route.

## AI telemetry (per assistant call)
Request ID · user ID · agent ID (AG-001) · model · prompt version · tools called · tool errors ·
input and output tokens · cost · latency (first token and total) · grounding check result.

## Alerts (`DECISION REQUIRED`: channel and thresholds)
- API error rate above threshold
- AI daily spend above threshold
- Grounding check failure rate above threshold
- Payment webhook failures
