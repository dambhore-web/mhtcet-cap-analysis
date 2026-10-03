# Fees (#42)

**Source.** The Fee Regulating Authority (FRA), Maharashtra, "Fee Approved" report for engineering
(`mahafraportal.org`, sub_type ENGG, type H&T), 2026-27 first, 2025-26 for colleges not yet on the
newer report. Built by `npm run fees -w @mhtcet/pipeline` (`packages/pipeline/src/fees`), loaded
into the `fee` table; matched to CAP colleges by the FRA institute id's digits (EN6271 → 06271),
or by exact name. Nothing is guessed: unmatched rows and colleges are listed in
`data/processed/2026/fees-match-report.json`.

**What the FRA covers.** Only unaided private institutes. Government, government-aided, university
and deemed institutes have fees set by the state or the university, so they are never on its report.

**Coverage, CAP 2026 (387 colleges, checked 2026-10-02)**

| | Colleges |
|---|---|
| FRA-approved fee (313 from 2026-27, 6 from 2025-26) | 319 |
| Government, government-aided or deemed: fees set by the state or university | 27 |
| Unaided, on neither FRA report (mostly new institutes) | 41 |

One possible match is left for a manual check, not assumed: CAP 05130 "Brahma Valley College of
Engineering & Research, Trimbakeshwar" and FRA EN5180 "Brahma Valley College of Engineering and
Research Institute, Anjaneri" (different codes).

**On the college page.** FRA fees show as "FRA-approved, <year>" with a link to the FRA report, the
report's status explained ("No Upward Revision": the college asked for no increase, so its earlier
approved fee continues; "Interim Order of High Court": may change), and "Confirm with the college
before paying". Every other college still gets a Fees section saying why there is no number, with
its TFWS seats from the CAP seat matrix. No fee is ever estimated.

**Not done.** Fees of government and aided colleges (COEP, VJTI, the GCOEs, ICT) from their own
official sources; that needs per-college sourcing with a link and a checked-on date.
