import { isSeatType } from "@mhtcet/core";
import { clusterLines, median, type Line, type Word } from "../layout.ts";

/**
 * Parser for the official "Cut Off List for Maharashtra & Minority Seats" PDFs (MH lists).
 *
 * Layout (2026): per college `NNNNN - Name`; per branch `<choice code> - <branch>`, a `Status:`
 * line, a section label (`State Level`, `Home University Seats Allotted to ...`, ...), a header
 * row of seat-type codes (plus the word `Stage`), then one row per stage: a stage label (`I`,
 * `II`, `I-Non PWD` ...) and closing merit numbers, followed by a row of `(percentiles)`.
 * Values sit in a regular column grid; header codes are centred in their cell, values are
 * left-aligned, so a value belongs to the header whose centre is nearest to value.x0 + pitch/2.
 * Cells can be empty. Tables wider than the page overflow onto a "continuation" page that has
 * no page title; its header and rows sit at the same y as the rows they continue.
 */

export interface MhCutoffCell {
  collegeCode: string;
  choiceCode: string;
  section: string;
  stage: string;
  seatType: string;
  closingMerit: number;
  closingPercentile: number | null;
  page: number;
}

export interface MhCollege {
  code: string;
  name: string;
}
export interface MhBranch {
  choiceCode: string;
  collegeCode: string;
  name: string;
  status: string | null;
  homeUniversity: string | null;
}
export interface ParseIssue {
  page: number;
  kind: string;
  detail: string;
}

interface Ctx {
  collegeCode: string;
  choiceCode: string;
  section: string;
}
interface Header {
  code: string;
  center: number;
}
interface Table {
  ctx: Ctx;
  y: number;
  headers: Header[];
  pitch: number;
  rows: Row[];
  /** For a continuation table: the table on the previous regular page it extends. */
  ref: Table | null;
}
interface Cell {
  x: number;
  seatType: string;
  merit: number;
  percentile: number | null;
}
interface Row {
  y: number;
  stageWords: string[];
  /** Continuation rows take their stage label from the row they extend. */
  stageRef: Row | null;
  cells: Cell[];
  table: Table;
  page: number;
}

/**
 * Historical PDFs used different seat-type spellings. Normalise to the canonical 2026 codes
 * before header detection so older years parse cleanly.
 *   ORPH / ORPHAN  → ORPHANN  (2024-2025 used short form for non-minority orphan)
 *   Codes missing trailing level letter (S = state level): PWDROBC → PWDROBCS, DEFRSEBC → DEFRSEBCS
 */
const SEAT_CODE_ALIASES: Record<string, string> = { ORPH: "ORPHANN", ORPHAN: "ORPHANN" };
function normSeatCode(code: string): string {
  const alias = SEAT_CODE_ALIASES[code];
  if (alias) return alias;
  if (!isSeatType(code) && isSeatType(code + "S")) return code + "S";
  return code;
}

const CHROME =
  /Government of Maharashtra|State Common Entrance Test Cell|Cut Off List for|Degree Courses|Master of Engineering|\(Integrated|Admissions A\.Y\./;
const TITLE_ROUND = /CAP\s+Round\s*-?\s*([IVX]+)\b/;
const COLLEGE = /^\d{5}$/;
/** Choice code: 9-10 digits plus optional suffix letters (T TFWS, L regional language, F female, U unaided, K Konkan). */
const CHOICE = /^\d{9,10}[A-Z]{0,3}$/;
const NUM = /^\d+$/;
const PCT = /^\((\d+(?:\.\d+)?)\)$/;
const SECTION = /(^State Level$)|Seats Allotted to|^Minority Seats|^All India Seats/;
/** Stage labels are printed left of the first value column. */
const LABEL_MAX_X = 70;
const DEFAULT_PITCH = 56;

export class MhCutoffParser {
  readonly colleges = new Map<string, MhCollege>();
  readonly branches = new Map<string, MhBranch>();
  readonly issues: ParseIssue[] = [];
  readonly titleRounds = new Set<string>();
  private readonly rows: Row[] = [];
  private page = 0;
  private collegeCode: string | null = null;
  private branch: MhBranch | null = null;
  private section: string | null = null;
  private table: Table | null = null;
  private lastRow: Row | null = null;
  private expect: "college-name" | "branch-name" | null = null;
  /** Tables of the most recent page that had a title (targets for continuation pages). */
  private regularTables: Table[] = [];

  addPage(words: Word[]): void {
    this.page++;
    const lines = clusterLines(words);
    const continuation = !lines.some((l) => /Government of Maharashtra/.test(l.text));
    if (!continuation) this.regularTables = [];
    this.table = null;
    this.lastRow = null;
    for (const line of lines) {
      if (/Legends/.test(line.text)) break; // footer: legend, note, page number
      if (CHROME.test(line.text)) {
        const m = TITLE_ROUND.exec(line.text);
        if (m) this.titleRounds.add(m[1]);
        continue;
      }
      this.line(line, continuation);
    }
  }

  private issue(kind: string, detail: string): void {
    this.issues.push({ page: this.page, kind, detail: detail.slice(0, 160) });
  }

  private line(line: Line, continuation: boolean): void {
    const ws = line.words;
    const t = ws.map((w) => w.text);

    if (COLLEGE.test(t[0]) && t[1] === "-") {
      this.collegeCode = t[0];
      this.colleges.set(t[0], { code: t[0], name: t.slice(2).join(" ") });
      this.branch = null;
      this.section = null;
      this.table = null;
      this.lastRow = null;
      this.expect = "college-name";
      return;
    }
    if (CHOICE.test(t[0]) && t[1] === "-") {
      if (!this.collegeCode) return this.issue("branch-without-college", line.text);
      this.branch = {
        choiceCode: t[0], collegeCode: this.collegeCode, name: t.slice(2).join(" "), status: null, homeUniversity: null,
      };
      this.branches.set(t[0], this.branch);
      this.section = null;
      this.table = null;
      this.lastRow = null;
      this.expect = "branch-name";
      return;
    }
    if (t[0] === "Status:") {
      if (this.branch) {
        const rest = t.slice(1).join(" ");
        const m = /^(.*?)\s*Home University\s*:\s*(.*)$/.exec(rest);
        this.branch.status = (m ? m[1] : rest).trim() || null;
        this.branch.homeUniversity = m ? m[2].trim() || null : null;
      }
      this.expect = null;
      return;
    }
    if (SECTION.test(line.text) && ws[0].x0 < LABEL_MAX_X) {
      this.section = line.text;
      this.table = null;
      this.lastRow = null;
      this.expect = null;
      return;
    }
    const codes = t.filter((x) => x !== "Stage").map(normSeatCode);
    if (codes.length && codes.every(isSeatType)) return this.header(line, codes, continuation);
    if (t.length === 1 && t[0] === "Stage") return;

    const nums = ws.filter((w) => NUM.test(w.text));
    const pcts = ws.filter((w) => PCT.test(w.text));
    const labels = ws.filter((w) => !NUM.test(w.text) && !PCT.test(w.text));
    const labelsOk = labels.every((w) => w.x0 < LABEL_MAX_X);
    if (nums.length && !pcts.length && labelsOk) return this.valueRow(line, nums, labels, continuation);
    if (pcts.length && !nums.length && labelsOk) return this.percentileRow(pcts, labels);
    if (this.expect === "college-name" && this.collegeCode && !nums.length) {
      this.colleges.get(this.collegeCode)!.name += ` ${line.text}`;
      return;
    }
    if (this.expect === "branch-name" && this.branch && !nums.length) {
      this.branch.name += ` ${line.text}`;
      return;
    }
    if (!nums.length && !pcts.length && labelsOk && this.lastRow) {
      this.lastRow.stageWords.push(...labels.map((w) => w.text));
      return;
    }
    this.issue("unrecognised-line", line.text);
  }

  private header(line: Line, codes: string[], continuation: boolean): void {
    const hws = line.words.filter((w) => w.text !== "Stage");
    const headers = hws.map((w) => ({ code: w.text, center: (w.x0 + w.x1) / 2 }));
    const diffs = headers.slice(1).map((h, i) => h.center - headers[i].center);
    const pitch = diffs.length ? median(diffs) : DEFAULT_PITCH;
    let ctx: Ctx;
    let ref: Table | null = null;
    if (continuation) {
      ref = this.regularTables.find((tb) => Math.abs(tb.y - line.y) <= 4) ?? null;
      if (!ref) return this.issue("continuation-without-table", codes.join(" "));
      ctx = ref.ctx;
    } else if (this.branch && this.section) {
      ctx = { collegeCode: this.branch.collegeCode, choiceCode: this.branch.choiceCode, section: this.section };
    } else {
      return this.issue("header-without-context", codes.join(" "));
    }
    this.table = { ctx, y: line.y, headers, pitch: pitch > 20 ? pitch : DEFAULT_PITCH, rows: [], ref };
    if (!continuation) this.regularTables.push(this.table);
    this.lastRow = null;
    this.expect = null;
  }

  private valueRow(line: Line, nums: Word[], labels: Word[], continuation: boolean): void {
    const table = this.table;
    if (!table) return this.issue("values-without-header", line.text);
    const row: Row = {
      y: line.y, stageWords: labels.map((w) => w.text), stageRef: null, cells: [], table, page: this.page,
    };
    if (continuation && table.ref) {
      row.stageRef = table.ref.rows.find((r) => Math.abs(r.y - line.y) <= 4) ?? null;
      if (!row.stageRef) this.issue("continuation-row-without-stage", line.text);
    }
    for (const w of nums) {
      const h = nearestHeader(table, w.x0 + table.pitch / 2);
      if (!h) {
        this.issue("value-outside-grid", `${w.text}@${w.x0.toFixed(0)} ${line.text}`);
        continue;
      }
      if (row.cells.some((c) => c.seatType === h.code)) {
        this.issue("two-values-one-cell", `${h.code} ${line.text}`);
        continue;
      }
      row.cells.push({ x: w.x0, seatType: h.code, merit: Number(w.text), percentile: null });
    }
    table.rows.push(row);
    this.rows.push(row);
    this.lastRow = row;
  }

  private percentileRow(pcts: Word[], labels: Word[]): void {
    const row = this.lastRow;
    if (!row) return this.issue("percentile-without-row", pcts.map((w) => w.text).join(" "));
    for (const w of pcts) {
      const cell = row.cells.find((c) => Math.abs(c.x - w.x0) < row.table.pitch / 2);
      if (!cell || cell.percentile !== null) {
        this.issue("percentile-without-cell", `${w.text}@${w.x0.toFixed(0)}`);
        continue;
      }
      cell.percentile = Number(PCT.exec(w.text)![1]);
    }
    row.stageWords.push(...labels.map((w) => w.text));
  }

  /** All parsed cells. Call after the last page. */
  cells(): MhCutoffCell[] {
    const out: MhCutoffCell[] = [];
    for (const r of this.rows) {
      const stage = (r.stageRef ?? r).stageWords.join(" ");
      if (!stage) this.issue("row-without-stage", `${r.table.ctx.choiceCode} y=${r.y.toFixed(0)}`);
      for (const c of r.cells) {
        out.push({
          ...r.table.ctx,
          stage,
          seatType: c.seatType,
          closingMerit: c.merit,
          closingPercentile: c.percentile,
          page: r.page,
        });
      }
    }
    return out;
  }
}

function nearestHeader(table: Table, target: number): Header | null {
  let best: Header | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const h of table.headers) {
    const d = Math.abs(h.center - target);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best && bestD <= table.pitch * 0.45 ? best : null;
}
