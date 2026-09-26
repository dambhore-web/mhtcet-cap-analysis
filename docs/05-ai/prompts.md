# Prompts

Production prompts live as files in `apps/api/prompts/` (not in code), one file per prompt and
version, e.g. `assistant.system.v1.md`. A change creates a new version file; the harness config
selects the active version. Telemetry records the version on every call.

Each prompt file starts with a header:
```yaml
name: assistant.system
version: 1
purpose: System prompt for AG-001 Admissions Assistant
inputs: [profile (optional), year list]
outputs: plain-language answer with citations
constraints: numbers only from tool results; no admission guarantees; English (Marathi DECISION REQUIRED)
evaluation: eval set v1 must pass (see evaluation.md)
```

## Planned prompts
| Name | Purpose | Status |
|---|---|---|
| `assistant.system` | Role, rules, citation format, refusal rules | Phase 7 |
| `assistant.grounding-retry` | Sent when the grounding check fails | Phase 7 |
| `eval.judge` | Optional LLM judge for tone and clarity in evals; never judges numbers (code checks those) | Phase 7, optional |
