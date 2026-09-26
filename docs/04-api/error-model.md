# Error model

Every error response has this shape:
```json
{ "error": { "code": "RANK_OUT_OF_RANGE", "message": "Merit number must be between 1 and 400000.",
  "category": "validation", "retryable": false, "requestId": "req_…" } }
```

| Field | Meaning |
|---|---|
| `code` | Stable machine-readable code, `UPPER_SNAKE` |
| `message` | Safe for users: says what went wrong and how to fix it |
| `category` | `validation` · `auth` · `forbidden` · `not_found` · `rate_limited` · `payment` · `model` · `tool` · `internal` |
| `retryable` | Whether retrying the same request may succeed |
| `requestId` | Matches the server log line; show it to users for support |

| Category | HTTP | Retryable |
|---|---|---|
| validation | 400 | no |
| auth | 401 | no |
| forbidden (e.g. plan doesn't include feature) | 403 | no |
| not_found | 404 | no |
| rate_limited / usage limit | 429 | yes, after the `Retry-After` delay |
| payment | 402 or 400 | depends |
| model (LLM provider error or timeout) | 502 / 504 | yes |
| tool (assistant tool failed) | 502 | yes |
| internal | 500 | yes |

Developer details (stack traces, provider responses) go only to server logs, keyed by `requestId`.
