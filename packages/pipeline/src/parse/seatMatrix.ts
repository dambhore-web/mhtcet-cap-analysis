/**
 * Parser for the CET Cell "Provisional Seat Matrix for CAP Round I" PDF (one branch per page;
 * same layout 2023–2026). See docs/02-architecture/data-pipeline.md ("Seat matrix layout").
 *
 * Page structure (words clustered into lines):
 *   01002 - Government College of Engineering, Amravati           college line (2023: "1002 - …")
 *   Government Autonomous CAP Seats:60                             status label + CAP seats
 *   Choice Code Course Name SI MS Seats Minority Seats All India Institute Seats OrphanI OrphanN
 *   0100219110 Civil Engineering 60 60 0 0 0 1 0                   2023–2025: one "Orphan" column
 *   Category OPEN SC ST VJ/DT NTB NTC NTD OBC SEBC Total           2023: no SEBC
 *   General / Ladies G L G L … G + L
 *   State Level 16 6 6 2 … 55      or   HU … / OHU …              G,L per category + total
 *   PWD 1 0 0 0 0 0 0 1 0 2                                        per category + total
 *   PWD Common Reserved Seats : 1
 *   DEF 1 0 0 0 0 0 0 1 0 2
 *   DEF Common Reserved Seats : 1
 *   Economically Weaker Section (EWS) Seats: 6 Tution Fee Waiver Scheme Choice Code: 0100219111T : Seats: 3
 *
 * Arithmetic observed on every page of all four years (except 4 branches of 06281 in 2026):
 *   SI = MS + Minority + All India + Institute;  CAP Seats = MS + Minority + All India;
 *   MS = level-row totals + PWD total + DEF total + orphan seats.
 * EWS and TFWS are supernumerary (outside SI). Common reserved seats are not additive (they are
 * not part of the MS sum); ASSUMPTION: they are a pool shared by all reserved categories, shown
 * as PWDR…/DEFR… seat types in the cutoff lists.
 */
import type { AuthorityId, Category } from "@mhtcet/core";
import { clusterLines, type Word } from "../layout.ts";
import { normaliseChoiceCode, normaliseCollegeCode } from "./codes.ts";

/** Category column headers → seat-type category codes used by the cutoff lists. */
export const CATEGORY_COLUMNS: Readonly<Record<string, Category>> = {
  OPEN: "OPEN", SC: "SC", ST: "ST", "VJ/DT": "VJ", NTB: "NT1", NTC: "NT2", NTD: "NT3", OBC: "OBC", SEBC: "SEBC",
};

/** Level rows → seat-type level letter. */
export const LEVEL_ROWS: Readonly<Record<string, "S" | "H" | "O">> = { "State Level": "S", HU: "H", OHU: "O" };

/**
 * Seat pools. `state`, `minority`, `all-india` and `institute` add up to the sanctioned intake;
 * `state` + `minority` + `all-india` are the CAP seats. `supernumerary` (EWS, TFWS) is on top of
 * the intake. `common-reserved` (PWDR, DEFR) overlaps the other seats and is never added.
 */
export type SeatPool = "state" | "minority" | "all-india" | "institute" | "supernumerary" | "common-reserved";

/** Seat-type codes that the matrix needs but the core grammar does not have (documented). */
export const MATRIX_ONLY_SEAT_TYPES = ["PWDR", "DEFR", "INSTITUTE"] as const;

export interface CategoryCounts { [category: string]: number }

export interface SeatMatrixBranch {
  page: number;
  collegeCode: string;
  collegeName: string;
  /** e.g. "Un-Aided Autonomous" or "Un-Aided Linguistic Minority - Hindi" */
  statusLabel: string;
  choiceCode: string;
  courseName: string;
  capSeats: number;
  sanctionedIntake: number;
  msSeats: number;
  minoritySeats: number;
  allIndiaSeats: number;
  instituteSeats: number;
  /** ORPHANI / ORPHANN (2026) or ORPHANN only (2023–2025 single "Orphan" column). */
  orphan: Record<string, number>;
  /** One entry per level row (State Level, or HU and OHU). */
  levels: { level: "S" | "H" | "O"; general: CategoryCounts; ladies: CategoryCounts; printedTotal: number }[];
  pwd: { counts: CategoryCounts; printedTotal: number };
  def: { counts: CategoryCounts; printedTotal: number };
  pwdCommon: number;
  defCommon: number;
  ews: number;
  tfws: number;
  /** Separate TFWS choice code printed on the page ("" when none); cutoff lists use choiceCode. */
  tfwsChoiceCode: string;
}

export interface SeatMatrixCell {
  seatType: string;
  pool: SeatPool;
  seats: number;
}

/** One row of seat_matrix.ndjson / table seat_matrix (one seat type of one branch, seats > 0). */
export interface SeatMatrixRow {
  authority: AuthorityId;
  exam: "MHT-CET";
  year: number;
  collegeCode: string;
  choiceCode: string;
  seatType: string;
  pool: SeatPool;
  seats: number;
  sourceFile: string;
  sourcePage: number;
}

export interface SeatMatrixIssue {
  page: number;
  message: string;
}

const nums = (s: string): number[] => s.trim().split(/\s+/).map(Number);

const COLLEGE_RE = /^(\d{4,5}) - (.+)$/;
const STATUS_RE = /^(.*?)\s*CAP Seats\s*:\s*(\d+)$/;
const LEVEL_RE = /^(State Level|HU|OHU)\s+((?:\d+\s+)*\d+)$/;
const QUOTA_RE = /^(PWD|DEF)\s+((?:\d+\s+)*\d+)$/;
const COMMON_RE = /^(PWD|DEF) Common Reserved Seats\s*:\s*(\d+)$/;
const EWS_RE = /^Economically Weaker Section \(EWS\) Seats:\s*(\d+)\s+Tution Fee Waiver Scheme Choice Code:\s*(\S*?)\s*:?\s*Seats:\s*(\d+)$/;
const FOOTER_RE = /^(F:Only For Female|Categories$|E:Off-Campus|Page \d+ of \d+|State CET Cell)/;

/**
 * Parse one page. `prevCollege` carries the college across pages in case a page omits the college
 * line (not observed, but cheap to handle). Returns null and records an issue when the page does
 * not have every expected row.
 */
export function parseSeatMatrixPage(
  words: Word[],
  page: number,
  issues: SeatMatrixIssue[],
  prevCollege?: { code: string; name: string; statusLabel: string; capSeats: number },
): SeatMatrixBranch | null {
  const lines = clusterLines(words).map((l) => l.text.replace(/\s+/g, " ").trim());
  const fail = (message: string): null => {
    issues.push({ page, message });
    return null;
  };

  let college = prevCollege ? { code: prevCollege.code, name: prevCollege.name } : null;
  let status: { label: string; cap: number } | null = null;
  let orphanCols: string[] | null = null;
  let cats: Category[] | null = null;
  let branch: { choiceCode: string; name: string; values: number[] } | null = null;
  let inCourseName = false;
  const levels: SeatMatrixBranch["levels"] = [];
  const quota: Partial<Record<"PWD" | "DEF", { counts: CategoryCounts; printedTotal: number }>> = {};
  const common: Partial<Record<"PWD" | "DEF", number>> = {};
  let ews: { ews: number; tfws: number; tfwsChoiceCode: string } | null = null;

  for (const text of lines) {
    let m: RegExpExecArray | null;
    if (!branch && (m = COLLEGE_RE.exec(text))) {
      college = { code: normaliseCollegeCode(m[1]), name: m[2].trim() };
      continue;
    }
    if (!branch && (m = STATUS_RE.exec(text))) {
      status = { label: m[1].trim(), cap: Number(m[2]) };
      continue;
    }
    if (text.startsWith("Choice Code Course Name")) {
      orphanCols = /\bOrphanI\b/.test(text) ? ["ORPHANI", "ORPHANN"] : /\bOrphan\b/.test(text) ? ["ORPHANN"] : [];
      continue;
    }
    if (orphanCols && !branch) {
      const n = 5 + orphanCols.length;
      m = new RegExp(`^(\\d{9,10}[A-Z]{0,3})\\s+(.*?)\\s+((?:\\d+\\s+){${n - 1}}\\d+)$`).exec(text);
      if (m) {
        branch = { choiceCode: normaliseChoiceCode(m[1]), name: m[2].trim(), values: nums(m[3]) };
        inCourseName = true;
        continue;
      }
    }
    if (text.startsWith("Category ")) {
      inCourseName = false;
      const heads = text.split(" ").slice(1);
      if (heads.at(-1) !== "Total") return fail(`category header without Total: ${text}`);
      const mapped = heads.slice(0, -1).map((h) => CATEGORY_COLUMNS[h]);
      if (mapped.some((c) => !c)) return fail(`unknown category column in: ${text}`);
      cats = mapped as Category[];
      continue;
    }
    if (inCourseName && branch && !/^(Seats|General \/ Ladies)/.test(text)) {
      branch.name = `${branch.name} ${text}`;
      continue;
    }
    if ((m = LEVEL_RE.exec(text))) {
      if (!cats) return fail(`level row before category header: ${text}`);
      const v = nums(m[2]);
      if (v.length !== 2 * cats.length + 1) return fail(`${m[1]} row has ${v.length} numbers, expected ${2 * cats.length + 1}`);
      const general: CategoryCounts = {};
      const ladies: CategoryCounts = {};
      cats.forEach((c, i) => {
        general[c] = v[2 * i];
        ladies[c] = v[2 * i + 1];
      });
      levels.push({ level: LEVEL_ROWS[m[1]], general, ladies, printedTotal: v.at(-1)! });
      continue;
    }
    if ((m = QUOTA_RE.exec(text))) {
      if (!cats) return fail(`${m[1]} row before category header`);
      const v = nums(m[2]);
      if (v.length !== cats.length + 1) return fail(`${m[1]} row has ${v.length} numbers, expected ${cats.length + 1}`);
      const counts: CategoryCounts = {};
      cats.forEach((c, i) => (counts[c] = v[i]));
      quota[m[1] as "PWD" | "DEF"] = { counts, printedTotal: v.at(-1)! };
      continue;
    }
    if ((m = COMMON_RE.exec(text))) {
      common[m[1] as "PWD" | "DEF"] = Number(m[2]);
      continue;
    }
    if ((m = EWS_RE.exec(text))) {
      ews = { ews: Number(m[1]), tfws: Number(m[3]), tfwsChoiceCode: m[2] ? normaliseChoiceCode(m[2]) : "" };
      continue;
    }
    if (FOOTER_RE.test(text)) continue;
  }

  if (!college) return fail("no college line");
  if (!status && prevCollege?.code === college.code) status = { label: prevCollege.statusLabel, cap: prevCollege.capSeats };
  if (!status) return fail("no 'CAP Seats:' line");
  if (!orphanCols) return fail("no branch header");
  if (!branch) return fail("no branch row");
  if (!cats) return fail("no category header");
  if (!levels.length) return fail("no State Level / HU / OHU row");
  if (!quota.PWD || !quota.DEF) return fail("missing PWD or DEF row");
  if (common.PWD === undefined || common.DEF === undefined) return fail("missing common reserved line");
  if (!ews) return fail("missing EWS / TFWS line");

  const [sanctionedIntake, msSeats, minoritySeats, allIndiaSeats, instituteSeats, ...orph] = branch.values;
  return {
    page,
    collegeCode: college.code,
    collegeName: college.name,
    statusLabel: status.label,
    choiceCode: branch.choiceCode,
    courseName: branch.name,
    capSeats: status.cap,
    sanctionedIntake, msSeats, minoritySeats, allIndiaSeats, instituteSeats,
    orphan: Object.fromEntries(orphanCols.map((c, i) => [c, orph[i]])),
    levels,
    pwd: quota.PWD,
    def: quota.DEF,
    pwdCommon: common.PWD,
    defCommon: common.DEF,
    ...ews,
  };
}

/** Parses a whole seat matrix page by page. */
export class SeatMatrixParser {
  readonly branches: SeatMatrixBranch[] = [];
  readonly issues: SeatMatrixIssue[] = [];
  private page = 0;

  addPage(words: Word[]): void {
    this.page++;
    const prev = this.branches.at(-1);
    const b = parseSeatMatrixPage(words, this.page, this.issues, prev && {
      code: prev.collegeCode, name: prev.collegeName, statusLabel: prev.statusLabel, capSeats: prev.capSeats,
    });
    if (b) this.branches.push(b);
  }
}

/**
 * Seat-type cells of one branch, only those with seats > 0 (a missing seat type means 0 seats).
 * Mapping to the cutoff-list codes (checked against 2023–2026 cutoff lists):
 *   level rows G/L × category → G<cat><S|H|O>, L<cat><S|H|O>
 *   PWD row → PWD<cat>H at branches with HU/OHU rows, else PWD<cat>S
 *   DEF row → DEF<cat>S (defence seats are always state level)
 *   Orphan → ORPHANI / ORPHANN (single pre-2026 column → ORPHANN, as the cutoff parser does)
 *   Minority → MI, All India → AI, Institute → INSTITUTE, EWS → EWS, TFWS → TFWS
 *   PWD / DEF common reserved → PWDR / DEFR
 */
export function branchCells(b: SeatMatrixBranch): SeatMatrixCell[] {
  const out: SeatMatrixCell[] = [];
  const add = (seatType: string, pool: SeatPool, seats: number): void => {
    if (seats > 0) out.push({ seatType, pool, seats });
  };
  for (const l of b.levels) {
    for (const [c, n] of Object.entries(l.general)) add(`G${c}${l.level}`, "state", n);
    for (const [c, n] of Object.entries(l.ladies)) add(`L${c}${l.level}`, "state", n);
  }
  const pwdLevel = b.levels.some((l) => l.level === "H") ? "H" : "S";
  for (const [c, n] of Object.entries(b.pwd.counts)) add(`PWD${c}${pwdLevel}`, "state", n);
  for (const [c, n] of Object.entries(b.def.counts)) add(`DEF${c}S`, "state", n);
  for (const [code, n] of Object.entries(b.orphan)) add(code, "state", n);
  add("MI", "minority", b.minoritySeats);
  add("AI", "all-india", b.allIndiaSeats);
  add("INSTITUTE", "institute", b.instituteSeats);
  add("EWS", "supernumerary", b.ews);
  add("TFWS", "supernumerary", b.tfws);
  add("PWDR", "common-reserved", b.pwdCommon);
  add("DEFR", "common-reserved", b.defCommon);
  return out;
}

const sum = (xs: Iterable<number>): number => {
  let s = 0;
  for (const x of xs) s += x;
  return s;
};

export interface BranchCheck {
  /** Each printed row total equals the sum of its cells (blocking). */
  rowTotals: string[];
  /** SI = MS + minority + AI + institute and CAP = MS + minority + AI (blocking). */
  intakeSplit: string[];
  /** MS = level totals + PWD + DEF + orphan (informational: a source inconsistency when it fails). */
  msSplit: string[];
}

/** Arithmetic checks of one branch against its printed totals. */
export function checkBranch(b: SeatMatrixBranch): BranchCheck {
  const rowTotals: string[] = [];
  for (const l of b.levels) {
    const s = sum(Object.values(l.general)) + sum(Object.values(l.ladies));
    if (s !== l.printedTotal) rowTotals.push(`level ${l.level}: cells ${s} != printed ${l.printedTotal}`);
  }
  for (const [name, q] of [["PWD", b.pwd], ["DEF", b.def]] as const) {
    const s = sum(Object.values(q.counts));
    if (s !== q.printedTotal) rowTotals.push(`${name}: cells ${s} != printed ${q.printedTotal}`);
  }
  const intakeSplit: string[] = [];
  const parts = b.msSeats + b.minoritySeats + b.allIndiaSeats + b.instituteSeats;
  if (parts !== b.sanctionedIntake) intakeSplit.push(`SI ${b.sanctionedIntake} != MS+MI+AI+institute ${parts}`);
  const cap = b.msSeats + b.minoritySeats + b.allIndiaSeats;
  if (cap !== b.capSeats) intakeSplit.push(`CAP Seats ${b.capSeats} != MS+MI+AI ${cap}`);
  const msSplit: string[] = [];
  const ms = sum(b.levels.map((l) => l.printedTotal)) + b.pwd.printedTotal + b.def.printedTotal + sum(Object.values(b.orphan));
  if (ms !== b.msSeats) msSplit.push(`MS ${b.msSeats} != levels+PWD+DEF+orphan ${ms}`);
  return { rowTotals, intakeSplit, msSplit };
}
