"""Parse CAP provisional allotment PDFs into seat-holder rows (names and IDs dropped).

First version, built against COEP (16006). Known gaps before running on all colleges:
- only State Level and All India section headers are tested
  (Home University / Other than HU / Minority / Institute sections still to verify)
- column x-positions are fixed to the COEP layout
- no per-branch check against the printed "CAP Seats: N" yet
"""
import re
import sys
from pathlib import Path

import fitz
import pandas as pd

ROOT = Path(__file__).resolve().parents[2] / "data"
SECTION_RE = re.compile(r"^(State Level|Home University|Other Than Home|All India|Minority|Institute)")
BRANCH_RE = re.compile(r"\b(\d{10}[A-Z]?)\s*(?:\[\w+\])?\s*-\s*(.+)")


def parse_pdf(path: Path, rnd: str) -> list[dict]:
    rows, branch, section = [], None, None
    for page in fitz.open(path):
        words = page.get_text("words")
        m = BRANCH_RE.search(page.get_text())
        if m:
            branch = (m.group(1), m.group(2).strip())
        lines: dict[int, list] = {}
        for w in words:
            lines.setdefault(round(w[1] / 2), []).append(w)
        heads = []
        for line in lines.values():
            line.sort(key=lambda w: w[0])
            text = " ".join(w[4] for w in line)
            if line[0][0] < 60 and SECTION_RE.match(text) and "Seats" in text:
                heads.append((line[0][1], text))
        heads.sort()
        for w in (w for w in words if re.fullmatch(r"EN\d{8}", w[4])):
            y = w[1]
            near = [v for v in words if abs(v[1] - y) < 4]

            def col(lo, hi, pat):
                hits = [v[4] for v in near if lo <= v[0] < hi and re.fullmatch(pat, v[4])]
                return hits[0] if hits else None

            section = next((s for hy, s in reversed(heads) if hy < y), section)
            rows.append(dict(
                round=rnd,
                college_code=path.stem.split("_")[-1],
                branch_code=branch[0] if branch else None,
                branch=branch[1] if branch else None,
                section=section,
                merit=col(60, 112, r"\d+"),
                score=col(100, 170, r"\d+\.\d+"),
                gender=col(400, 440, r"[MFT]"),
                category=col(440, 510, r"\S+"),
                seat_type=col(505, 600, r"[A-Z0-9]+"),
            ))
    return rows


def main(year: str = "2026") -> None:
    src = ROOT / "raw" / year / "allotment"
    out = ROOT / "processed" / f"allotment_{year}.csv"
    rows: list[dict] = []
    for pdf in sorted(src.glob("CAPR-*_*.pdf")):
        rnd = pdf.stem.split("_")[0].split("-")[1]
        rows += parse_pdf(pdf, rnd)
        print(f"[PARSE] {pdf.name}: {len(rows)} rows total", flush=True)
    pd.DataFrame(rows).to_csv(out, index=False)
    print(f"[PARSE] wrote {out}", flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:])
