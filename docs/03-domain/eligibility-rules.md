# Eligibility rules

These rules decide which seat types a candidate is matched against. They are implemented once,
in `packages/core`. Anything not confirmed from an official CET Cell source is marked.

## Rules used in the COEP 2026 dashboard
| Candidate | Eligible seat types (State Level) |
|---|---|
| Any Maharashtra candidate | `GOPENS` |
| Reserved category X (OBC, SEBC, SC, ST, VJ, NT1–NT3) | also `G<X>S` |
| Female | also `LOPENS`, and `L<X>S` if reserved category X |
| EWS eligible | also `EWS` |
| TFWS eligible | also `TFWS` |
| All India candidate (JEE) | `AI` only, no category reservation |

## To confirm before launch (`UNKNOWN` until checked against the CET Cell information brochure)
- Home University (`…H`) vs Other than Home University (`…O`) eligibility, by the candidate's university region.
- Whether a reserved-category candidate who fails the category rank still competes on `GOPEN…`
  (the dashboard assumes yes).
- Defence (`DEF…`, `DEFR…`), PWD (`PWD…`, `PWDR…`), orphan and minority (`MI`) rules.
- Meaning of the `$`, `#`, `@` markers on candidate categories.
- Whether EWS and TFWS are separate lists or overlap for the same candidate.

## Matching rule
For each college-branch, take the eligible seat types that exist there. For each, compare the
candidate's merit with the closing merit per round:
- merit ≤ Round I closing → "Round I"
- else merit ≤ latest round closing → "later round"
- else → "out of range"
Report the best status across eligible seat types, with the seat type and closing merit used.
This is history, not a prediction of next year.
