# Data sources catalogue

Source page: `https://fe2026.mahacet.org/StaticPages/HomePage` (catalogued 2026-09-27).
PDF base: `https://cappublicdocs2026.blob.core.windows.net/` (below: `blob/`).
AG-002 re-discovers these from the page before each run; don't hard-code them.

## Needed for launch
| Data | File(s) | Contains names? | Use |
|---|---|---|---|
| Cutoffs 2026, state | `blob/documents/2026ENGG_CAP1_MH_CutOff_V1.pdf`, `…CAP2_MH_CutOff.pdf`, `…CAP3_MH_CutOff.pdf`, `…CAP4_MH_CutOff.pdf` | No | Core cutoffs |
| Cutoffs 2026, All India | `blob/documents/2026ENGG_CAP{1..4}_AI_CutOff.pdf` | No | All India cutoffs |
| Cutoffs 2026, Diploma | `blob/documents/2026ENGG_CAP4_Diploma_CutOff.pdf` | No | Diploma seats |
| Seat matrix 2026 (Round I) | `blob/documents/2026_fe_seatmatrix_V1.pdf` | No | Seats per seat type per branch |
| Colleges with intake | page `StaticPages/frmInstituteList.aspx?did=1884` | No | College master: code, name, district, university, type, intake |
| Dr. BATU affiliated colleges | page `StaticPages/frmInstituteList_BATU.aspx?did=62354` | No | Colleges under BATU (university for HU) |
| Off-campus institutes | `blob/documents/FE2026_OffCampus_Institutes.pdf` | No | College master |
| **Maharashtra State merit list (PCM), final** | `blob/meritlists/final/FE2026_PCMMH_MeritList_Final.pdf` (64 MB) | **Yes, drop** | CET percentile → state merit no |
| All India merit list (PCM), final | `blob/meritlists/final/FE2026_PCMAI_MeritList_Final.pdf` (71 MB) | **Yes, drop** | JEE percentile → All India merit no (parsed) |
| Defence merit list (PCM), final | `blob/meritlists/final/FE2026_PCMDEF_MeritList_Final.pdf` (1 MB) | **Yes, drop** | Defence percentile → merit (optional) |
| CAP admission brochure | `blob/documents/PublicPages/Information_Brochure_UG_PG_2026_27_dt_2_7_2026_DHG_1_Display.pdf` | No | Rules (read) |

## History (trends)
| Year | Files (base `https://fe2026.mahacet.org/<year>/`) |
|---|---|
| 2025 | `2025SeatMatrix.pdf`, `2025ENGG_CAP{1..4}_CutOff.pdf`, `2025ENGG_CAP{1..4}_AI_CutOff.pdf`, `2025ENGG_CAP4_CutOff_Diploma.pdf` |
| 2024 | `2024SeatMatrix.pdf`, `2024ENGG_CAP{1..3}_CutOff.pdf`, `2024ENGG_CAP{1..3}_AI_CutOff.pdf`, `2024ENGG_CAP3_CutOff_Diploma.pdf` |
| 2023 | `2023SeatMatrix.pdf`, `2023ENGG_CAP{1..3}_CutOff.pdf`, `2023ENGG_CAP{1..3}_AI_CutOff.pdf`, `2023ENGG_CAP3_CutOff_Diploma.pdf` |
2023–2024 had 3 CAP rounds; 2025–2026 had 4.

## Good to have
| Data | File(s) | Use |
|---|---|---|
| Vacancy after each round | `blob/documents/FE2026_Vacancy_For_CAP{2,3,4}.pdf`, `…_For_ACAP.pdf`, `…_For_CAP3_NewInstitute_CourtOder.pdf` | Seats still open before the next round |
| Institute-wise allotment lists | page `StaticPages/frmInstituteWiseAllotmentList.aspx?did=2021` (1,548 PDFs, names: drop) | Opening merit, seats filled, gender, turnover |
| PCB merit lists (MH, AI, DEF, J&K) | `blob/meritlists/final/FE2026_PCB*_MeritList_Final.pdf` | PCB candidates (9 branches) |
| Important dates, notices | `frmImportantDates.aspx`, `ViewPublicDocument?MenuId=…` (incl. "Cut Off Circular" 9785) | Reminders; cutoff definitions |
| Fees (external) | `https://ay26-27.mahafraportal.org/ssi_prp_25/outer.php?q=fee_search_report` | Fee per college/course |

## Outside the CET Cell
| Data | Source | Notes |
|---|---|---|
| **District + approved fees** | FRA engineering report: `https://ay26-27.mahafraportal.org/ssi_prp_25/admin/reports/ajax/get_report_ajax.php?district=all&institute=&sub_type=ENGG&type=HT` (HTML table). Search page: `…/outer.php?q=fee_search_report`. 2025-26: `ay25-26.mahafraportal.org/ssi_prp_24/…` | Columns: Inst ID, name, **District**, status, tuition fee, development fee, total fee, review values. `EN<code>` = CAP code (zero-pad to 5 digits). **306 of 387 CAP colleges match** (checked 2026-09-27). Unmatched: 26 government/aided/university (FRA doesn't set their fees) + 54 unaided (to investigate: other `type` values, or 2025-26 report) |
| NIRF rankings | `https://www.nirfindia.org` | Engineering category; 2025 is the latest confirmed; check for 2026 |
| NBA-accredited programmes | `https://www.nbaind.org/accreditationprogram` | Per programme (branch), by tier |
| NAAC grades | `http://www.naac.gov.in/index.php/en/19-quick-links/62-accreditationresults` | Per institution |
| AICTE approvals | `https://www.aicte-india.org` (approved institutes dashboard) | Approved intake per branch |
| Dr. BATU affiliated colleges | `https://dbatu.ac.in/list-of-affiliated-institute/` | University mapping for BATU colleges |

## Not used
Provisional merit lists (superseded by final), J&K migrant lists (out of scope), personal
status-check pages, login pages, registration manuals.
