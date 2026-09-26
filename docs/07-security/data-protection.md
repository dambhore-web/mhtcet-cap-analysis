# Data protection

## Data we handle
| Data | Source | Personal? | Stored where | Rule |
|---|---|---|---|---|
| Candidate names, application IDs | CET Cell PDFs | Yes (mostly minors) | Only inside raw PDFs on the operator's machine | Never parsed into outputs, never committed, never uploaded (ADR-003) |
| Merit numbers, scores, gender, category of seat holders | CET Cell PDFs | Not identifying once names and IDs are dropped (`ASSUMPTION`, confirm in legal review) | Local row data; only aggregates in the DB | Aggregates only in the product |
| User account (auth ID, email/phone) | Sign-in | Yes | Auth provider + DB | Minimum needed |
| User profile (rank, category, gender, flags) | User input | Yes, sensitive | DB | Own-row access only; not logged; minimal fields to the LLM |
| Payment records | Payment provider | Yes | Provider; DB keeps plan, status, provider reference only | No card or UPI details stored |
| Assistant conversations | User input | May contain personal data | `DECISION REQUIRED`: store or not, and for how long | If stored: own-row access, retention limit |

## DPDP Act 2023 (India)
Consent notice at sign-up, purpose limitation, erasure on request, grievance contact, and breach
handling are required for a paid product. Details: `DECISION REQUIRED` with legal review
(`legal-open-items.md`).

## Encryption
In transit: HTTPS everywhere. At rest: provider default (e.g. Supabase disk encryption).
Column-level encryption for profile data: `DECISION REQUIRED`.
