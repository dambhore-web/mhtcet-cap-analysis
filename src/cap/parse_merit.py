"""Parse the All India (PCM) final merit list into merit no, exam, score (names and IDs dropped)."""
import csv
import re
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[2] / "data"
ROW_RE = re.compile(
    r"(?:^|\n)(\d+)\s*\n?\s*EN\d{8}(?:[^\n]*\n){0,4}?[^\n]*?"
    r"(JEE|MHT-CET-PCM|Diploma|D\.Voc\.)\n([\d.]+)"
)


def main(year: str = "2026") -> None:
    doc = fitz.open(ROOT / "raw" / year / "merit" / "PCMAI_final.pdf")
    out = ROOT / "processed" / f"ai_merit_{year}.csv"
    n = 0
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["merit", "exam", "score"])
        for page in doc:
            for m in ROW_RE.finditer(page.get_text()):
                w.writerow([int(m.group(1)), m.group(2), float(m.group(3))])
                n += 1
    print(f"[MERIT] {n} rows -> {out}", flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:])
