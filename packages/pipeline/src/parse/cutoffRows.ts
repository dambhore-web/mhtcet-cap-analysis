import { clusterLines, type Word } from "../layout.ts";
import type { ParseIssue } from "./cutoffMh.ts";

/**
 * Parser for the row-per-branch official cutoff lists: the All India list (`..._AI_CutOff.pdf`)
 * and the Diploma / D.Voc list (`..._Diploma_CutOff.pdf`).
 *
 * Layout (2026): one record per choice code with columns Sr. No · All India merit ·
 * (percentile) · choice code · institute name · course name · merit exam · type · seat type.
 * Multi-line cells are vertically centred, so the record's words are spread over ~ +-12 pt around
 * the choice code. Each record is anchored on its choice code; every other column takes the word
 * in its x-window nearest in y to the anchor.
 */

export interface RowCutoff {
  srNo: number | null;
  collegeCode: string;
  choiceCode: string;
  closingMerit: number;
  closingPercentile: number | null;
  exam: string | null;
  /** Printed "Type" column, e.g. `AI to AI`; null when the list has none. */
  type: string | null;
  seatType: string | null;
  page: number;
}

interface Window {
  lo: number;
  hi: number;
}
export interface RowListLayout {
  srNo: Window;
  merit: Window;
  percentile: Window;
  choiceCode: Window;
  exam: Window;
  type: Window | null;
  seatType: Window | null;
}

export const AI_LAYOUT: RowListLayout = {
  srNo: { lo: 40, hi: 80 },
  merit: { lo: 80, hi: 112 },
  percentile: { lo: 105, hi: 165 },
  choiceCode: { lo: 160, hi: 225 },
  exam: { lo: 620, hi: 708 },
  type: { lo: 700, hi: 760 },
  seatType: { lo: 760, hi: 840 },
};

/**
 * 2023 AI lists have slightly different column positions vs 2026:
 *   Round I  — exam x≈630, type x=690/699/709, seatType x=758
 *   Rounds II/III — exam x≈637, type x=697/706/715, seatType x=765
 * The windows are made tighter to avoid cross-column captures.
 */
export const AI_LAYOUT_2023: RowListLayout = {
  srNo: { lo: 40, hi: 80 },
  merit: { lo: 80, hi: 122 },
  percentile: { lo: 105, hi: 165 },
  choiceCode: { lo: 160, hi: 230 },
  exam: { lo: 615, hi: 685 },
  type: { lo: 685, hi: 750 },
  seatType: { lo: 750, hi: 840 },
};

export const DIPLOMA_LAYOUT: RowListLayout = {
  srNo: { lo: 40, hi: 80 },
  merit: { lo: 80, hi: 122 },
  percentile: { lo: 105, hi: 165 },
  choiceCode: { lo: 160, hi: 225 },
  exam: { lo: 680, hi: 790 },
  type: null,
  seatType: null,
};

/** 2023–2025 Diploma PDFs use a narrower portrait layout (choice code at x≈119, not 160+). */
export const DIPLOMA_LAYOUT_2023: RowListLayout = {
  srNo: { lo: 20, hi: 55 },
  merit: { lo: 42, hi: 80 },
  percentile: { lo: 72, hi: 120 },
  choiceCode: { lo: 110, hi: 165 },
  exam: { lo: 655, hi: 760 },
  type: null,
  seatType: null,
};

const CHOICE = /^\d{9,10}[A-Z]{0,3}$/;
const NUM = /^\d+$/;
/** Serial numbers are printed with thousands separators ("1,000"). */
const SERIAL = /^\d{1,3}(?:,\d{3})*$/;
const PCT = /^\((\d+(?:\.\d+)?)\)$/;
const MAX_DY = 12;

export class RowListParser {
  readonly issues: ParseIssue[] = [];
  readonly titleRounds = new Set<string>();
  readonly rows: RowCutoff[] = [];
  private page = 0;

  constructor(private readonly layout: RowListLayout) {}

  addPage(words: Word[]): void {
    this.page++;
    for (const l of clusterLines(words)) {
      const m = /Cut Off List for.*?CAP\s+Round\s*-?\s*([IVX]+)\b/.exec(l.text);
      if (m) this.titleRounds.add(m[1]);
    }
    const L = this.layout;
    const inW = (w: Word, win: Window): boolean => w.x0 >= win.lo && w.x0 < win.hi;
    const anchors = words.filter((w) => inW(w, L.choiceCode) && CHOICE.test(w.text));
    const used = new Set<Word>();
    const pick = (a: Word, win: Window, re: RegExp): Word | null => {
      let best: Word | null = null;
      for (const w of words) {
        if (used.has(w) || !inW(w, win) || !re.test(w.text)) continue;
        const dy = Math.abs(w.y0 - a.y0);
        if (dy <= MAX_DY && (!best || dy < Math.abs(best.y0 - a.y0))) best = w;
      }
      if (best) used.add(best);
      return best;
    };
    const joinWin = (a: Word, win: Window): string | null => {
      const ws = words
        .filter((w) => inW(w, win) && Math.abs(w.y0 - a.y0) <= MAX_DY && !used.has(w))
        .sort((x, y) => x.y0 - y.y0 || x.x0 - y.x0);
      ws.forEach((w) => used.add(w));
      return ws.length ? ws.map((w) => w.text).join(" ") : null;
    };
    for (const a of anchors.sort((x, y) => x.y0 - y.y0)) {
      const merit = pick(a, L.merit, NUM);
      const pct = pick(a, L.percentile, PCT);
      const sr = pick(a, L.srNo, SERIAL);
      if (!merit) {
        this.issues.push({ page: this.page, kind: "row-without-merit", detail: a.text });
        continue;
      }
      if (!pct) this.issues.push({ page: this.page, kind: "row-without-percentile", detail: a.text });
      const digitLen = (a.text.match(/^\d+/)?.[0] ?? "").length;
      this.rows.push({
        srNo: sr ? Number(sr.text.replace(/,/g, "")) : null,
        collegeCode: a.text.slice(0, digitLen === 9 ? 4 : 5),
        choiceCode: a.text,
        closingMerit: Number(merit.text),
        closingPercentile: pct ? Number(PCT.exec(pct.text)![1]) : null,
        exam: joinWin(a, L.exam),
        type: L.type ? joinWin(a, L.type) : null,
        seatType: L.seatType ? joinWin(a, L.seatType) : null,
        page: this.page,
      });
    }
  }

  /** Serial numbers must run 1..N without gaps; returns the problems found. */
  checkSerials(): string[] {
    const problems: string[] = [];
    this.rows.forEach((r, i) => {
      if (r.srNo !== i + 1) problems.push(`row ${i + 1}: Sr. No ${r.srNo ?? "missing"} (${r.choiceCode}, page ${r.page})`);
    });
    return problems;
  }
}
