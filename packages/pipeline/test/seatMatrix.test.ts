import { describe, expect, it } from "vitest";
import { isSeatType } from "@mhtcet/core";
import type { Word } from "../src/layout.ts";
import {
  branchCells, checkBranch, MATRIX_ONLY_SEAT_TYPES, parseSeatMatrixPage, SeatMatrixParser, type SeatMatrixIssue,
} from "../src/parse/seatMatrix.ts";
import { line } from "./words.ts";

/** Words of one text line: each whitespace token placed 30 pt apart from x = 74. */
const row = (y: number, text: string): Word[] => line(y, ...text.split(" ").map((t, i): [number, string] => [74 + i * 30, t]));
const footer = (y: number): Word[] => [
  ...row(y, "F:Only For Female, K:Konkan Seats, L:Regional Language, HU:Home University"),
  ...row(y + 30, "Page 7 of 99"),
  ...row(y + 40, "State CET Cell, Maharashtra State"),
];

// Synthetic college and branch (fake code 99001); 2026 layout with State Level row.
const page2026 = [
  ...row(43, "99001 - Test College of Engineering, Testnagar"),
  ...row(59, "Un-Aided Autonomous CAP Seats:102"),
  ...row(74, "Choice Code Course Name SI MS Seats Minority Seats All India Institute Seats OrphanI OrphanN"),
  ...row(89, "9900124550F Computer Engineering 120 84 0 18 18 0 1"),
  ...row(102, "Category OPEN SC ST VJ/DT NTB NTC NTD OBC SEBC Total"),
  ...row(115, "General / Ladies G L G L G L G L G L G L G L G L G L G + L"),
  ...row(135, "State Level 0 29 0 9 0 6 0 2 0 2 0 3 0 2 0 14 0 8 75"),
  ...row(152, "PWD 2 1 0 0 0 0 0 1 0 4"),
  ...row(169, "PWD Common Reserved Seats : 0"),
  ...row(186, "DEF 2 1 0 0 0 0 0 1 0 4"),
  ...row(203, "DEF Common Reserved Seats : 1"),
  ...row(220, "Economically Weaker Section (EWS) Seats: 12 Tution Fee Waiver Scheme Choice Code: 9900124551FT : Seats: 6"),
  ...footer(438),
];

// 2023 layout: 4-digit college code, 9-digit choice code, one Orphan column, no SEBC, HU/OHU rows,
// wrapped course name, TFWS choice code without the ":" separator.
const page2023 = [
  ...row(43, "6006 - Test Institute of Technology, Testpur"),
  ...row(59, "Un-Aided CAP Seats:54"),
  ...row(74, "Choice Code Course Name SI MS Seats Minority Seats All India Institute Orphan"),
  ...row(83, "Seats"),
  ...row(96, "600624210 Computer Science and Engineering(Artificial 60 45 0 9 6 1"),
  ...row(105, "Intelligence and Machine Learning)"),
  ...row(115, "Category OPEN SC ST VJ/DT NTB NTC NTD OBC Total"),
  ...row(128, "General / Ladies G L G L G L G L G L G L G L G L G + L"),
  ...row(148, "HU 10 4 3 2 1 0 1 0 1 0 1 0 1 0 5 2 31"),
  ...row(165, "OHU 4 2 1 0 0 0 0 0 0 0 0 0 0 0 1 1 9"),
  ...row(182, "PWD 1 0 0 0 0 0 0 1 2"),
  ...row(199, "PWD Common Reserved Seats : 1"),
  ...row(216, "DEF 1 0 0 0 0 0 0 1 2"),
  ...row(233, "DEF Common Reserved Seats : 1"),
  ...row(250, "Economically Weaker Section (EWS) Seats: 6 Tution Fee Waiver Scheme Choice Code: 600624211T Seats: 3"),
  ...footer(430),
];

describe("parseSeatMatrixPage (2026 layout)", () => {
  const issues: SeatMatrixIssue[] = [];
  const b = parseSeatMatrixPage(page2026, 7, issues)!;
  it("reads the branch line and printed totals", () => {
    expect(issues).toEqual([]);
    expect(b).toMatchObject({
      page: 7, collegeCode: "99001", collegeName: "Test College of Engineering, Testnagar", statusLabel: "Un-Aided Autonomous",
      choiceCode: "9900124550F", courseName: "Computer Engineering", capSeats: 102, sanctionedIntake: 120, msSeats: 84,
      minoritySeats: 0, allIndiaSeats: 18, instituteSeats: 18, orphan: { ORPHANI: 0, ORPHANN: 1 },
      pwdCommon: 0, defCommon: 1, ews: 12, tfws: 6, tfwsChoiceCode: "9900124551FT",
    });
    expect(b.levels).toHaveLength(1);
    expect(b.levels[0].level).toBe("S");
    expect(b.levels[0].ladies).toMatchObject({ OPEN: 29, SC: 9, ST: 6, VJ: 2, NT1: 2, NT2: 3, NT3: 2, OBC: 14, SEBC: 8 });
  });
  it("maps cells to cutoff-list seat types, drops zeros and assigns pools", () => {
    const cells = branchCells(b);
    const get = (t: string) => cells.find((c) => c.seatType === t);
    expect(get("LOPENS")).toEqual({ seatType: "LOPENS", pool: "state", seats: 29 });
    expect(get("LNT1S")?.seats).toBe(2);
    expect(get("GOPENS")).toBeUndefined(); // zero → no row
    expect(get("PWDOPENS")?.seats).toBe(2); // state-level branch → S
    expect(get("DEFOBCS")?.seats).toBe(1);
    expect(get("ORPHANN")).toEqual({ seatType: "ORPHANN", pool: "state", seats: 1 });
    expect(get("ORPHANI")).toBeUndefined();
    expect(get("AI")).toEqual({ seatType: "AI", pool: "all-india", seats: 18 });
    expect(get("INSTITUTE")).toEqual({ seatType: "INSTITUTE", pool: "institute", seats: 18 });
    expect(get("EWS")).toEqual({ seatType: "EWS", pool: "supernumerary", seats: 12 });
    expect(get("TFWS")?.seats).toBe(6);
    expect(get("DEFR")).toEqual({ seatType: "DEFR", pool: "common-reserved", seats: 1 });
    expect(get("PWDR")).toBeUndefined();
    expect(cells.every((c) => c.seats > 0)).toBe(true);
    const extra = new Set<string>(MATRIX_ONLY_SEAT_TYPES);
    expect(cells.filter((c) => !extra.has(c.seatType) && !isSeatType(c.seatType))).toEqual([]);
    // state + minority + all-india + institute = sanctioned intake
    const intake = cells.filter((c) => ["state", "minority", "all-india", "institute"].includes(c.pool)).reduce((s, c) => s + c.seats, 0);
    expect(intake).toBe(120);
  });
  it("passes the arithmetic checks", () => {
    expect(checkBranch(b)).toEqual({ rowTotals: [], intakeSplit: [], msSplit: [] });
  });
});

describe("parseSeatMatrixPage (2023 layout)", () => {
  const issues: SeatMatrixIssue[] = [];
  const b = parseSeatMatrixPage(page2023, 1, issues)!;
  it("normalises codes, joins the wrapped course name and reads one Orphan column", () => {
    expect(issues).toEqual([]);
    expect(b.collegeCode).toBe("16006"); // 6006 → 06006 → 16006
    expect(b.choiceCode).toBe("1600624210");
    expect(b.tfwsChoiceCode).toBe("1600624211T");
    expect(b.courseName).toBe("Computer Science and Engineering(Artificial Intelligence and Machine Learning)");
    expect(b.orphan).toEqual({ ORPHANN: 1 });
    expect(b.levels.map((l) => l.level)).toEqual(["H", "O"]);
    expect(Object.keys(b.pwd.counts)).not.toContain("SEBC");
  });
  it("uses H for PWD at home-university branches and S for DEF", () => {
    const types = branchCells(b).map((c) => c.seatType);
    expect(types).toEqual(expect.arrayContaining(["GOPENH", "LOPENH", "GOPENO", "LOBCO", "PWDOPENH", "PWDOBCH", "DEFOPENS", "ORPHANN", "PWDR", "DEFR"]));
    expect(types.filter((t) => t.startsWith("PWD") && t.endsWith("S"))).toEqual([]);
  });
  it("passes the arithmetic checks", () => {
    expect(checkBranch(b)).toEqual({ rowTotals: [], intakeSplit: [], msSplit: [] });
  });
});

describe("checks and issues", () => {
  it("flags a row whose cells do not add up to its printed total, and a wrong MS split", () => {
    const bad = page2026.map((w) => (w.y0 === 135 && w.text === "75" ? { ...w, text: "76" } : w));
    const b = parseSeatMatrixPage(bad, 1, [])!;
    const c = checkBranch(b);
    expect(c.rowTotals).toEqual(["level S: cells 75 != printed 76"]);
    expect(c.msSplit).toHaveLength(1);
  });
  it("flags SI and CAP Seats that do not match their parts", () => {
    const bad = page2026.map((w) => (w.y0 === 59 && w.text === "Seats:102" ? { ...w, text: "Seats:100" } : w));
    const c = checkBranch(parseSeatMatrixPage(bad, 1, [])!);
    expect(c.intakeSplit).toEqual(["CAP Seats 100 != MS+MI+AI 102"]);
  });
  it("records an issue when a level row has the wrong number of cells", () => {
    const issues: SeatMatrixIssue[] = [];
    const bad = page2026.filter((w) => !(w.y0 === 135 && w.text === "8"));
    expect(parseSeatMatrixPage(bad, 3, issues)).toBeNull();
    expect(issues).toEqual([{ page: 3, message: "State Level row has 18 numbers, expected 19" }]);
  });
  it("records an issue for a page without a branch row", () => {
    const issues: SeatMatrixIssue[] = [];
    expect(parseSeatMatrixPage(footer(400), 5, issues)).toBeNull();
    expect(issues[0].page).toBe(5);
  });
  it("parses pages in sequence", () => {
    const p = new SeatMatrixParser();
    p.addPage(page2023);
    p.addPage(page2026);
    expect(p.branches.map((b) => [b.page, b.choiceCode])).toEqual([[1, "1600624210"], [2, "9900124550F"]]);
    expect(p.issues).toEqual([]);
  });
});
