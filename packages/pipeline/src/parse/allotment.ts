import { isSeatType, type AllotmentBranch, type AllotmentRow, type Round } from "@mhtcet/core";
import { APPLICATION_ID, clusterLines, type Word } from "../layout.ts";

/**
 * Parser for institute-wise provisional allotment lists (`CAPR-<round>_<code>.pdf`).
 * TypeScript port of the Python prototype (`src/cap/parse_allotment.py`), with these changes:
 * - branch headers are located by position, so a page holding two branches is split correctly;
 * - `VACANT` rows and the printed seat counts (`CAP Seats: N` …) are collected for the check;
 * - choice codes may carry suffix letters and an `[EWS]`-style tag.
 *
 * Rows are anchored on the application ID (read only as an anchor, never stored). Columns are
 * fixed x-windows observed on the 2026 layout; a word belongs to a row when its y is within 4 pt
 * of the ID. Names and IDs are dropped here and never leave this function.
 */

const SECTION_RE = /^(State Level|Home University|Other Than Home|All India|Minority|Institute|Maharashtra State|ORPHAN)/;
const BRANCH_RE = /^(\d{10}[A-Z]{0,3})\s*(?:\[(\w+)\])?\s*-\s*(.+)$/;
const ROW_BAND = 4;

interface Col {
  lo: number;
  hi: number;
  re: RegExp;
}
const COLS = {
  merit: { lo: 60, hi: 112, re: /^\d+$/ },
  score: { lo: 100, hi: 170, re: /^\d+\.\d+$/ },
  gender: { lo: 400, hi: 440, re: /^[MFT]$/ },
  /** Category may be several words ("NT 2 (NT-C)$/DEF2") starting left of 440. */
  category: { lo: 428, hi: 505, re: /^\S+$/ },
  seatType: { lo: 505, hi: 600, re: /^[A-Z0-9]+$/ },
} satisfies Record<string, Col>;

/**
 * Category = all words in the category window, joined. When the category text runs into the seat
 * type column, pdf.js returns one glued word (e.g. "(NT-C)$/DEF2DEFRNT2S"); the seat type is then
 * the longest suffix that parses as a seat type and starts at or right of the seat-type column.
 */
export function categoryAndSeatType(near: Word[]): { category: string | null; seatType: string | null } {
  const c = COLS.category;
  const s = COLS.seatType;
  const catWords = near.filter((v) => v.x0 >= c.lo && v.x0 < c.hi).map((v) => ({ ...v }));
  let seat = near.find((v) => v.x0 >= s.lo && v.x0 < s.hi && s.re.test(v.text))?.text ?? null;
  if (!seat && catWords.length) {
    const last = catWords[catWords.length - 1];
    const cw = (last.x1 - last.x0) / last.text.length;
    for (let i = 1; i < last.text.length; i++) {
      const suffix = last.text.slice(i);
      if (last.x0 + i * cw >= s.lo - 3 && isSeatType(suffix)) {
        seat = suffix;
        last.text = last.text.slice(0, i);
        break;
      }
    }
  }
  const category = catWords.map((v) => v.text).join(" ") || null;
  return { category, seatType: seat };
}

function num(re: RegExp, text: string): number | null {
  const m = re.exec(text);
  return m ? Number(m[1]) : null;
}

export class AllotmentParser {
  readonly rows: AllotmentRow[] = [];
  readonly branches = new Map<string, AllotmentBranch>();
  private branch: { choiceCode: string; name: string } | null = null;
  private section: string | null = null;
  private page = 0;
  readonly issues: { page: number; kind: string; detail: string }[] = [];

  constructor(
    private readonly year: number,
    private readonly round: Round,
    private readonly collegeCode: string,
  ) {}

  addPage(words: Word[]): void {
    this.page++;
    const lines = clusterLines(words);
    type Mark = { y: number; kind: "branch"; choiceCode: string; name: string } | { y: number; kind: "section"; text: string };
    const marks: Mark[] = [];
    for (const l of lines) {
      if (l.words[0].x0 >= 60) continue;
      const b = BRANCH_RE.exec(l.text);
      if (b) {
        marks.push({ y: l.y, kind: "branch", choiceCode: b[1], name: b[3].trim() });
        continue;
      }
      if (SECTION_RE.test(l.text) && l.text.includes("Seats")) marks.push({ y: l.y, kind: "section", text: l.text });
      if (/Sanction\s+Intake/.test(l.text)) this.seatCounts(l.text, l.y, marks);
    }
    marks.sort((a, b) => a.y - b.y);

    const anchors = words.filter((w) => APPLICATION_ID.test(w.text)).sort((a, b) => a.y0 - b.y0);
    const vacants = words.filter((w) => w.text === "VACANT").sort((a, b) => a.y0 - b.y0);
    const events = [
      ...marks.map((m) => ({ y: m.y, mark: m as Mark | null, anchor: null as Word | null, vacant: false })),
      ...anchors.map((a) => ({ y: a.y0, mark: null, anchor: a, vacant: false })),
      ...vacants.map((a) => ({ y: a.y0, mark: null, anchor: a, vacant: true })),
    ].sort((a, b) => a.y - b.y || (a.mark ? -1 : 1));

    for (const e of events) {
      if (e.mark) {
        if (e.mark.kind === "branch") {
          this.branch = { choiceCode: e.mark.choiceCode, name: e.mark.name };
          this.ensureBranch();
        } else {
          this.section = e.mark.text;
        }
        continue;
      }
      const a = e.anchor!;
      if (!this.branch) {
        this.issues.push({ page: this.page, kind: "row-before-branch", detail: "" });
        continue;
      }
      const near = words.filter((v) => Math.abs(v.y0 - a.y0) < ROW_BAND).sort((p, q) => p.x0 - q.x0);
      const col = (c: Col): string | null => near.find((v) => v.x0 >= c.lo && v.x0 < c.hi && c.re.test(v.text))?.text ?? null;
      const b = this.ensureBranch();
      if (e.vacant) {
        b.vacantRows++;
        const st = col(COLS.seatType) ?? "";
        b.vacantBySeatType[st] = (b.vacantBySeatType[st] ?? 0) + 1;
        continue;
      }
      b.parsedRows++;
      const cs = categoryAndSeatType(near);
      const merit = col(COLS.merit);
      const score = col(COLS.score);
      this.rows.push({
        year: this.year,
        round: this.round,
        collegeCode: this.collegeCode,
        choiceCode: this.branch.choiceCode,
        branch: this.branch.name,
        section: this.section ?? "",
        merit: merit === null ? null : Number(merit),
        score: score === null ? null : Number(score),
        gender: col(COLS.gender),
        ...cs,
      });
      b.rowsBySeatType[cs.seatType ?? ""] = (b.rowsBySeatType[cs.seatType ?? ""] ?? 0) + 1;
    }
  }

  private ensureBranch(): AllotmentBranch {
    const b = this.branch!;
    let rec = this.branches.get(b.choiceCode);
    if (!rec) {
      rec = {
        round: this.round, collegeCode: this.collegeCode, choiceCode: b.choiceCode, branch: b.name,
        sanctionIntake: null, capSeats: null, msSeats: null, minoritySeats: null, aiSeats: null, parsedRows: 0, vacantRows: 0, rowsBySeatType: {}, vacantBySeatType: {},
      };
      this.branches.set(b.choiceCode, rec);
    }
    return rec;
  }

  /** The seat-count line belongs to the nearest branch header above it on the page. */
  private seatCounts(text: string, y: number, marks: { y: number; kind: string; choiceCode?: string }[]): void {
    const above = marks.filter((m) => m.kind === "branch" && m.y < y).pop();
    const code = above?.choiceCode ?? this.branch?.choiceCode;
    if (!code) return;
    const name = above && "name" in above ? String((above as { name: string }).name) : (this.branch?.name ?? "");
    let rec = this.branches.get(code);
    if (!rec) {
      rec = {
        round: this.round, collegeCode: this.collegeCode, choiceCode: code, branch: name,
        sanctionIntake: null, capSeats: null, msSeats: null, minoritySeats: null, aiSeats: null, parsedRows: 0, vacantRows: 0, rowsBySeatType: {}, vacantBySeatType: {},
      };
      this.branches.set(code, rec);
    }
    rec.sanctionIntake ??= num(/Sanction\s+Intake\s*:\s*(\d+)/, text);
    rec.capSeats ??= num(/CAP\s+Seats\s*:\s*(\d+)/, text);
    rec.msSeats ??= num(/MS\s+Seats\s*:\s*(\d+)/, text);
    rec.minoritySeats ??= num(/Minority\s+Seats\s*:\s*(\d+)/, text);
    rec.aiSeats ??= num(/AI\s+Seats\s*:\s*(\d+)/, text);
  }
}
