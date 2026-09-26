# Glossary

| Term | Meaning |
|---|---|
| **CET Cell** | State Common Entrance Test Cell, Government of Maharashtra. Runs MHT-CET and CAP. |
| **MHT-CET** | Maharashtra's engineering entrance exam. Scored as a percentile (e.g. 99.8737180). |
| **JEE (Main)** | National entrance exam. Used to rank All India candidates. |
| **CAP** | Centralised Admission Process: rounds (I, II, III, IV…) in which seats are allotted by merit and choices. |
| **Allotment list** | Per-college, per-round PDF (`CAPR-<round>_<college code>.pdf`) listing every candidate holding a seat after that round. |
| **Merit list** | Ranking of all candidates. State merit uses MHT-CET; the All India (PCM) list ranks JEE candidates first, then others. |
| **Merit number** | A candidate's position in the relevant merit list. Lower is better. |
| **Closing merit / cutoff** | The highest merit number holding a seat of a given type in a branch after a round. |
| **College (institute) code** | 4–5 digit code, e.g. `16006` = COEP Technological University. |
| **Choice code / branch code** | College code + branch digits, e.g. `1600624210` = COEP Computer Science. Suffix `T` = TFWS list; `[EWS]` = EWS list. |
| **Home University (HU)** | Seats reserved for candidates from the university region the college belongs to. |
| **Other than Home University (OHU)** | Seats for candidates from other university regions. |
| **State Level** | Seats open to all Maharashtra candidates (autonomous and state-level institutes). |
| **All India (AI)** | Seats for All India candidates ranked on JEE (Main). No category reservation. |
| **TFWS** | Tuition Fee Waiver Scheme seats (income-based). |
| **EWS** | Economically Weaker Section seats. |
| **DEF / DEFR** | Defence quota / defence common reserved seat. |
| **PWD / PWDR** | Persons with disability quota / PWD common reserved seat. |
| **ORPHAN** | Orphan quota (`ORPHANI` institutional, `ORPHANN` non-institutional). |
| **MI** | Minority seats allotted to candidates of the eligible religious or linguistic community. |
| **Categories** | OPEN, OBC, SEBC, SC, ST, VJ/DT (VJ), NT-B (NT1), NT-C (NT2), NT-D (NT3), SBC. `$`, `#`, `@` suffixes in lists are CET Cell markers whose exact meaning is `UNKNOWN`. |

## Seat-type code grammar
From the legend printed on each allotment list:
- First letter: `G` general, `L` ladies.
- Middle: category (`OPEN`, `OBC`, `SEBC`, `SC`, `ST`, `VJ`, `NT1`, `NT2`, `NT3`).
- Last letter: `H` Home University, `O` Other than Home University, `S` State Level.
- Examples: `GOPENS` general open state-level · `LOBCH` ladies OBC home university.
- Standalone codes: `AI`, `EWS`, `TFWS`, `MI`, `ORPHANI`, `ORPHANN`, and `DEF…`/`PWD…` prefixed forms
  such as `DEFOPENS`, `PWDROBCS`.

The full rule set lives in `docs/03-domain/eligibility-rules.md`.
