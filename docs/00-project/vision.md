# Vision

## Problem
Every year, lakhs of students in Maharashtra apply for first-year engineering seats through the
State CET Cell's Centralised Admission Process (CAP). The CET Cell publishes the results as
PDFs: one allotment list per college per round, plus merit lists. The information is public but
hard to use. A student who wants to know "with my merit number and category, which colleges and
branches could I have got last year?" has to open hundreds of PDFs and read seat-type codes.

## What we build
A paid web product that turns those PDFs into clear answers:
- **Rank finder:** enter merit number (or JEE percentile), category, gender and eligibility flags,
  and see every college and branch that number reached, and in which round.
- **College pages:** closing merit per branch, seat type and round, as in the COEP 2026 dashboard.
- **AI assistant:** ask the same questions in plain language; every number it gives comes from
  the data, with the source row cited.

## Who it's for
- Students preparing CAP option forms and their parents (primary). `ASSUMPTION`: the paying
  customer is usually the parent.
- Counsellors and coaching institutes (secondary, `ASSUMPTION`).

## What success looks like
`DECISION REQUIRED`: the owner sets launch targets (users, paid conversions, revenue) in
`docs/01-requirements/pricing-and-plans.md`. None are assumed here.

## Principles
- Accurate before clever: numbers always trace to published data.
- Honest about uncertainty: past cutoffs are history, not a promise of admission.
- Respect privacy: no candidate names or IDs, ever.
