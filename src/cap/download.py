"""Download CAP allotment PDFs and the All India merit list into data/raw/.

Usage:
    python -m src.cap.download --year 2026 --codes 16006 --ai-merit
"""
import argparse
import time
from pathlib import Path

import requests

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
ALLOT_URL = "https://fe{year}.mahacet.org/CAP-{r}/CAPR-{r}_{code}.pdf"
AI_MERIT_URL = (
    "https://cappublicdocs{year}.blob.core.windows.net/meritlists/final/"
    "FE{year}_PCMAI_MeritList_Final.pdf"
)


def fetch(url: str, dest: Path, delay: float) -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        return True
    resp = requests.get(url, timeout=300)
    time.sleep(delay)
    if resp.status_code != 200 or not resp.content.startswith(b"%PDF"):
        print(f"[DOWNLOAD] skip {url} ({resp.status_code})", flush=True)
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(resp.content)
    print(f"[DOWNLOAD] saved {dest.name} ({len(resp.content) // 1024} KB)", flush=True)
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--codes", nargs="+", required=True)
    ap.add_argument("--rounds", nargs="+", default=["I", "II", "III", "IV"])
    ap.add_argument("--delay", type=float, default=1.5, help="seconds between requests")
    ap.add_argument("--ai-merit", action="store_true", help="also fetch the All India merit list")
    a = ap.parse_args()
    for code in a.codes:
        for r in a.rounds:
            fetch(ALLOT_URL.format(year=a.year, r=r, code=code),
                  RAW / str(a.year) / "allotment" / f"CAPR-{r}_{code}.pdf", a.delay)
    if a.ai_merit:
        fetch(AI_MERIT_URL.format(year=a.year),
              RAW / str(a.year) / "merit" / "PCMAI_final.pdf", a.delay)


if __name__ == "__main__":
    main()
