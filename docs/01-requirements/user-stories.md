# User stories

The first stories, covering the P1 functional requirements. More are added as phases start.

## US-001 Find options for my merit number
As a **candidate**, I want to **enter my state merit number, category and gender** so that **I
see which colleges and branches that number reached last year**.
- **Preconditions:** cutoff data for the selected year is loaded.
- **Main flow:** enter merit number, category, gender, optional flags (EWS, TFWS, home university)
  → see a list of college-branch options, each marked "Round I", "later round" or "out of range",
  with the seat type and closing merit that qualified.
- **Alternate:** enter a JEE percentile instead → the All India merit number is estimated and All
  India seats are checked.
- **Exceptions:** merit number out of range or empty → a clear message; no data for the year → say so.
- **Acceptance criteria:**
  - Results match `packages/core` rank-finder output for the same inputs.
  - Each option shows its source (college, branch, seat type, round, year).
  - A candidate is only matched against seat types they are eligible for (`03-domain/eligibility-rules.md`).
- **API:** `POST /api/rank-finder` (`04-api/api-contracts.md`).
- **Data:** cutoff tables; merit-list percentile lookup.
- **Security:** inputs validated; not logged.
- **Tests:** unit tests on eligibility and matching; e2e for the form.

## US-002 See a college's cutoffs
As a **candidate or parent**, I want to **open a college page** so that **I see closing merit
for every branch, seat type and round**.
- **Acceptance criteria:** numbers match the parsed allotment lists; COEP 2026 matches the
  existing dashboard values (e.g. Computer Science GOPENS closes at 150 in Round I and 170 in Round IV).
- **API:** `GET /api/colleges/:code/cutoffs?year=`.

## US-003 Ask the assistant
As a **paying user**, I want to **ask in plain language** ("OBC girl, merit 8,000, Pune only,
which CS seats?") so that **I get an answer without learning seat-type codes**.
- **Main flow:** message → assistant calls tools → answer with a cited list.
- **Exceptions:** question outside the data (another state, a future prediction) → the assistant
  says what it can and can't answer; message limit reached → upgrade prompt.
- **Acceptance criteria:** every number in the answer appears in a tool result from that turn;
  it never promises admission; it passes the evaluation set (`05-ai/evaluation.md`).
- **Security:** prompt-injection cases in the eval set are handled.

## US-004 Buy a plan
As a **parent**, I want to **pay for a plan** so that **my child can use the paid features**.
- **Acceptance criteria:** payment verified server-side through a signed webhook; entitlement
  active within seconds; the receipt shows plan and amount.
- **Open:** plans, prices and payment provider are `DECISION REQUIRED` (`pricing-and-plans.md`).

## US-005 Sign in
As a **user**, I want to **sign in with Google or phone** so that **my plan and saved profile follow me**.
- **Open:** auth provider and methods are `DECISION REQUIRED`.
