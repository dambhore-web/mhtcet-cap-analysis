# Guardrails

| Risk | Guardrail |
|---|---|
| Invented numbers | Numbers only from tool results; code-level grounding check before the answer is sent |
| Overconfident advice | Never promise admission; always frame cutoffs as past results and name the year and round |
| Prompt injection ("ignore instructions") | User text is data; tools are allow-listed and read-only; the system prompt can't be changed by users; adversarial eval cases |
| Requests for candidate personal data | No such data exists in the DB; the assistant refuses and explains |
| Tool abuse (huge queries, scraping via chat) | Argument schemas with bounds; result size caps; per-user rate and usage limits |
| Off-topic use | Politely declines questions outside CAP admissions |
| Sensitive user data sent to the model | Only the profile fields the question needs; no payment or contact data |
| Model/provider outage | Retryable error to the user; never fall back to an unverified answer |
