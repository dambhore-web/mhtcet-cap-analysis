# Requirements

Derived from the owner's requests in the 2026-09-27 working session. Priorities are
`ASSUMPTION`s until the owner confirms them. P1 = needed for paid launch, P2 = soon after, P3 = later.

## Business requirements
| ID | Requirement | Objective | Priority |
|---|---|---|---|
| BR-001 | Help candidates see which colleges and branches their merit number or JEE percentile reached in past CAP rounds | Core value | P1 |
| BR-002 | Cover all Maharashtra first-year engineering colleges in CAP | Completeness | P1 |
| BR-003 | Offer a plain-language AI assistant grounded in the cutoff data | Differentiation | P1 |
| BR-004 | Charge for the product through paid plans | Revenue | P1 |
| BR-005 | Show trends across years | Better decisions | P3 |
| BR-006 | Never expose candidate names or application IDs | Privacy, trust | P1 |

## Functional requirements
| ID | Requirement | Traces to | Priority |
|---|---|---|---|
| FR-001 | Download allotment PDFs for any college code and round, and merit lists, with caching and rate limiting | BR-002 | P1 |
| FR-002 | Parse allotment PDFs into seat-holder rows without names or IDs | BR-002, BR-006 | P1 |
| FR-003 | Validate each parsed branch against the printed `CAP Seats: N` and report failures | BR-002 | P1 |
| FR-004 | Compute closing merit, minimum score and seat count per college × branch × seat type × round × year | BR-001 | P1 |
| FR-005 | Rank finder: given merit number or JEE percentile, category, gender and flags (EWS, TFWS, defence, PWD, home university), list reachable college-branch options with the round reached | BR-001 | P1 |
| FR-006 | Convert JEE percentile to All India merit number using the All India merit list | BR-001 | P1 |
| FR-007 | College page: cutoffs per branch, seat type and round | BR-001 | P1 |
| FR-008 | Filters: district, university, branch group, seat type | BR-001 | P2 |
| FR-009 | AI assistant answers questions using only tool results and cites the source rows | BR-003 | P1 |
| FR-010 | Accounts with sign-in | BR-004 | P1 |
| FR-011 | Paid plans, payment, and server-side entitlement checks | BR-004 | P1 |
| FR-012 | Usage metering per user (assistant messages, tokens) | BR-003, BR-004 | P1 |
| FR-013 | Multi-year data and trend views | BR-005 | P3 |

## Non-functional requirements
| ID | Requirement | Priority |
|---|---|---|
| NFR-001 | Every number shown to users traces to a source row (college, branch, seat type, round, year) | P1 |
| NFR-002 | Rank finder responds in under 1 s at p95 (`ASSUMPTION` target) | P1 |
| NFR-003 | Assistant first token in under 3 s at p95 (`ASSUMPTION` target) | P2 |
| NFR-004 | Works on phones (most users `ASSUMPTION`) | P1 |
| NFR-005 | English at launch; Marathi `DECISION REQUIRED` | P2 |
| NFR-006 | Personal data handled per the DPDP Act 2023 (`07-security/data-protection.md`) | P1 |
| NFR-007 | AI cost per user stays within the plan budget (`05-ai/cost.md`) | P1 |
| NFR-008 | Parser passes the CAP Seats check on ≥ 99% of branches before data is published (`ASSUMPTION` threshold) | P1 |

## Acceptance criteria
Per-story acceptance criteria are in `user-stories.md`.
