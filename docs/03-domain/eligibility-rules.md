# Eligibility rules

These rules decide which seat types a candidate is matched against. They are implemented once,
in `packages/core`.

**Sources (2026-27):**
- [CAP] *Information Brochure for Admission to Under Graduate and Post Graduate Technical Courses
  (2026-27)*, dated 2 July 2026, linked from `fe2026.mahacet.org`:
  `https://cappublicdocs2026.blob.core.windows.net/documents/PublicPages/Information_Brochure_UG_PG_2026_27_dt_2_7_2026_DHG_1_Display.pdf`
- [CET] *MHT-CET 2026 Information Brochure* (exam), `cetcell.mahacet.org`.

Section numbers below refer to [CAP] unless marked.

## 1. Candidature (rule 5)
| Candidature | Seats they compete for |
|---|---|
| Maharashtra State (Types A–E) | Home University / Other than HU / State Level seats, plus reserved seats if eligible |
| All India | `AI` seats only, ranked on JEE (Main) first, then CET, Diploma, D.Voc. (rule 10(2)). No category reservation |
| Minority | Minority quota seats (`MI`) in minority institutions of their community |
| NRI, OCI/PIO, Gulf, J&K/Ladakh migrant | Institution-level or supernumerary seats, not in CAP cutoffs. **Out of scope** |

Reservations below apply to Maharashtra State candidates only (rule 7(6)).

## 2. Seat split by institution type (Schedule-I A(1), A(2))
| Institution type | Maharashtra State seats | All India | Minority | Institutional |
|---|---|---|---|---|
| Government / Govt-aided / University depts, **autonomous** | 100% State Level | — | — | — |
| Same, **non-autonomous** | 70% HU, 30% OHU | — | — | — |
| ICT Mumbai, LIT Nagpur | 70% State Level | 30% | — | — |
| Dr. Babasaheb Ambedkar Tech. Univ., Lonere | 85% State Level + 15% for Konkan-district candidates | — | — | — |
| Govt / Govt-aided minority colleges | Autonomous 50% State Level; non-autonomous 35% HU + 15% OHU | — | 50% | — |
| **COEP Technological University** | 80% State Level | 20% | — | — |
| Unaided private (non-minority) | Autonomous 65% State Level; non-autonomous 45.5% HU + 19.5% OHU | 15% | — | 20% |
| Unaided minority | Remaining M.S. seats: autonomous State Level; non-autonomous 70% HU / 30% OHU | 15% of CAP seats | ≥ 51% of CAP seats | 20% |

Check against data: COEP Civil lists 150 CAP seats = 120 MS + 30 AI, which is exactly 80% / 20%.

## 3. Home University (rule 2, Rule 4 list)
A candidate's Home University is the university area where they **passed the qualifying exam
(HSC/Diploma)**. A college's HU seats (`…H`) go to candidates whose HU is the college's affiliating
university; its OHU seats (`…O`) go to Maharashtra candidates from other university areas.
The brochure lists 10 university areas with their districts (e.g. Savitribai Phule Pune University:
Ahmednagar, Nashik, Pune; Mumbai University: Mumbai City, Mumbai Suburban, Ratnagiri, Raigad,
Palghar, Sindhudurg, Thane). The rank finder needs the candidate's HU and each college's university.

Each stage runs first with HU/OHU tags, then again without them if seats remain (rule 11(6)).

## 4. Reservations (rule 7(6))
| Reservation | Share | Seat-type codes | Notes |
|---|---|---|---|
| SC | 13% | `GSC…`, `LSC…` | |
| ST | 7% | `GST…`, `LST…` | |
| VJ/DT (NT-A) | 3% | `GVJ…`, `LVJ…` | |
| NT-B | 2.5% | `GNT1…`, `LNT1…` | |
| NT-C | 3.5% | `GNT2…`, `LNT2…` | |
| NT-D | 2% | `GNT3…`, `LNT3…` | |
| OBC | 19% | `GOBC…`, `LOBC…` | |
| SEBC | 10% | `GSEBC…`, `LSEBC…` | Subject to High Court decision |
| Female | 30% of seats | `L…` | Not applied within Defence, PWD or Orphan |
| Defence | 5% | `DEF…` (category-wise), `DEFR…` (common merit list) | Maharashtra-domiciled children of defence personnel (not civilian staff); priority order I–IX |
| Persons with Disability | 5% | `PWD…`, `PWDR…` | ≥ 40% permanent benchmark disability |
| EWS | 10%, over and above intake | `EWS` | |
| Orphan | 1% of CAP seats (not minority or AI) | `ORPHANI`, `ORPHANN` | |
| TFWS | Up to 5%, supernumerary | `TFWS` | Maharashtra candidates with parents' income < ₹8 lakh; separate merit list; can't change college or course later |

## 5. How seats are allotted (rule 10(1)); this drives matching
- **Stage I:** everyone competes on merit.
  - Reserved-category candidates are first considered for **General** seats on merit, and for
    their category's seats if General seats aren't available at their merit.
  - EWS and Orphan candidates are considered for their reserved seats first, then General.
  - SBC candidates compete in General (or their original reserved category if they had one).
  - PWD and Defence seats are allotted **within** the candidate's own category (General or
    reserved), and from a combined list (`PWDR…`, `DEFR…`) for remaining seats.
  - When a candidate qualifies for several seats, the order is Orphan → Ladies → PWD → Defence.
- **Stage II:** vacant ladies seats go to male candidates of the same category.
- **Stage III:** vacant reserved seats go to SBC candidates, up to 2%.
- **Stage IV:** remaining seats to all candidates on merit, regardless of reservation.
- **Stage V:** remaining seats to All India candidates. **Stage VI:** then Diploma, then D.Voc.

## 6. Matching rules for the rank finder
A candidate is compared with these seat types:
| Candidate | Eligible seat types |
|---|---|
| Maharashtra, any | `GOPEN` + suffix (`S` everywhere; `H` at colleges of their HU; `O` at other colleges) |
| + reserved category X | also `G<X>` + suffix |
| + female | also `LOPEN` + suffix, and `L<X>` + suffix if reserved |
| + EWS | also `EWS` |
| + TFWS eligible | also `TFWS` |
| + Defence | also `DEFOPEN…`, `DEF<X>…`, `DEFR…` |
| + PWD | also `PWDOPEN…`, `PWD<X>…`, `PWDR…` |
| + Orphan | also `ORPHANI`, `ORPHANN` |
| + minority of the college's community | also `MI` |
| All India candidate | `AI` only, compared by All India merit number |
Female Defence, PWD and Orphan candidates use the same codes (no ladies split in those).

**What an official cutoff value means.** Each round's list gives the closing merit **of the seats
allotted in that round only**, not of everyone holding a seat. So a seat type with no new allotments
in a round is simply absent from that round's list, and a later round's value can be lower than an
earlier one (e.g. COEP AI & ML TFWS: 466 in Round I, 372 in Round II). Checked in the staging DB
on 2026-09-27.

Per seat type:
- merit ≤ Round I closing → **"Round I"**
- else merit ≤ the **highest** closing published in any later round (II–IV) → **"later round"**,
  naming that round
- else → **"out of range"** (show the loosest closing across all rounds)

Report the best status across eligible seat types, with the seat type, round and closing merit
used. Never carry a value into a round where the seat type isn't listed. Results are history,
not a prediction.

## 7. Other eligibility
- [CET] PCB-only candidates (no Maths) may only take 9 disciplines: Agriculture Engg,
  Biotechnology, Food Engg, Leather Tech, Packaging Tech, Pharmaceutical Engg, Printing Engg,
  Fashion Tech, Textile Chemistry. The rank finder should ask PCM or PCB.
- [CET] Minimum 45% in the qualifying subjects (40% for reserved categories, EWS and PWD from
  Maharashtra). The product assumes the user meets this.

## Still `UNKNOWN`
- Meaning of the `$`, `#`, `@` markers after candidate categories in allotment lists
  (e.g. `SEBC$`, `OBC#`, `OPEN@`). They don't affect cutoffs, but are needed for analysis by category.
- Seat-type code for SBC stage-III allotments, if any appears in the lists.
- The Konkan 15% seats at Dr. Babasaheb Ambedkar Technological University: how they're coded.
