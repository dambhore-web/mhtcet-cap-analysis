# MHT-CET CAP Analysis

Closing-rank analysis of Maharashtra first-year engineering admissions (MHT-CET CAP rounds),
built from the State CET Cell's published allotment lists and merit lists.

## Status
- Done: COEP Technological University (16006), 2026 Rounds I–IV, in `dashboards/coep-2026.html`
- Done: 2026 All India (PCM) merit list joined to All India seats
- Next: scale to all Maharashtra colleges

## Layout
| Path | What |
|------|------|
| `src/cap/download.py` | Fetch allotment PDFs per college and round, and the All India merit list |
| `src/cap/parse_allotment.py` | Allotment PDF → one row per seat holder |
| `src/cap/parse_merit.py` | All India merit list → merit no, exam, percentile |
| `dashboards/` | HTML dashboards (aggregated data only) |
| `data/raw/`, `data/processed/` | Local only, git-ignored |

## Quick start
```bash
pip install -r requirements.txt
python -m src.cap.download --year 2026 --codes 16006 --ai-merit
python -m src.cap.parse_allotment 2026
python -m src.cap.parse_merit 2026
```

## Privacy
The source PDFs contain candidate names and application IDs. The parsers drop both, and raw
PDFs and row-level CSVs are git-ignored. Only aggregated cutoffs go into dashboards.

## Roadmap
1. Harden the parser on 5 varied sample colleges: Home University, Minority and Institute
   sections; column detection from each page's header; a per-branch check against the printed
   `CAP Seats: N`
2. Build the college code list and download all colleges
3. Cutoff summary table (college × branch × seat type × round)
4. Rank finder across all colleges; per-college pages
5. Add earlier years for trends
