import type { AppCache } from "../startup.ts";
import type { Branch, College, CutoffRow, Round } from "@mhtcet/core";

/**
 * A small, deterministic dataset in the exact shape the database cache has, used by
 * end-to-end tests and by `npm run dev:demo` when no database is available.
 * The numbers are invented and are not official data.
 */

export const DEMO_YEAR = 2026;

interface DemoCollege {
  code: string;
  name: string;
  homeUniversity: string | null;
  district: string;
  type: string;
  totalIntake: number;
}

export const DEMO_COLLEGES: DemoCollege[] = [
  { code: "16006", name: "COEP Technological University", homeUniversity: null, district: "Pune", type: "Autonomous", totalIntake: 780 },
  { code: "06271", name: "Pune Institute of Computer Technology", homeUniversity: "Savitribai Phule Pune University", district: "Pune", type: "Unaided", totalIntake: 540 },
  { code: "03012", name: "Veermata Jijabai Technological Institute", homeUniversity: null, district: "Mumbai City", type: "Government", totalIntake: 720 },
  { code: "06007", name: "Vishwakarma Institute of Technology", homeUniversity: "Savitribai Phule Pune University", district: "Pune", type: "Unaided", totalIntake: 600 },
  { code: "01012", name: "Government College of Engineering Amravati", homeUniversity: "Sant Gadge Baba Amravati University", district: "Amravati", type: "Government", totalIntake: 420 },
  { code: "02189", name: "Shri Guru Gobind Singhji Institute of Engineering and Technology Nanded", homeUniversity: null, district: "Nanded", type: "Government", totalIntake: 480 },
];

export const DEMO_BRANCHES = [
  "Computer Engineering",
  "Information Technology",
  "Electronics and Telecommunication Engineering",
  "Mechanical Engineering",
];

const ROUNDS: Round[] = ["I", "II", "III", "IV"];

const SECTION = {
  S: "State Level",
  H: "Home University Seats Allotted to Home University Candidates",
  O: "Other Than Home University Seats Allotted to Other Than Home University Candidates",
} as const;

/** Seat types offered, with the section they are printed under. Home-university seats only at HU colleges. */
function seatTypesFor(c: DemoCollege): { seatType: string; section: string }[] {
  const base = [
    { seatType: "GOPENS", section: SECTION.S },
    { seatType: "LOPENS", section: SECTION.S },
    { seatType: "GOBCS", section: SECTION.S },
    { seatType: "TFWS", section: SECTION.S },
    { seatType: "EWS", section: SECTION.S },
  ];
  if (!c.homeUniversity) return base;
  return [
    ...base,
    { seatType: "GOPENH", section: SECTION.H },
    { seatType: "GOPENO", section: SECTION.O },
    { seatType: "GOBCH", section: SECTION.H },
  ];
}

/** Closing merit rises with college, branch, seat type and round, like the real lists do. */
function closingMerit(ci: number, bi: number, si: number, ri: number): number {
  return 600 + ci * 3200 + bi * 1400 + si * 450 + ri * 380;
}

export function demoChoiceCode(collegeCode: string, branchIndex: number): string {
  return `${collegeCode}${String(branchIndex + 1).padStart(2, "0")}910`;
}

export function demoCache(): AppCache {
  const colleges = new Map<string, College>();
  const branches = new Map<string, Branch>();
  const cutoffsByChoiceCode = new Map<string, CutoffRow[]>();

  DEMO_COLLEGES.forEach((c, ci) => {
    colleges.set(c.code, {
      authority: "MH-CET-CELL",
      exam: "MHT-CET",
      code: c.code,
      name: c.name,
      status: null,
      homeUniversity: c.homeUniversity,
      totalIntake: c.totalIntake,
      district: c.district,
      collegeType: c.type,
    });

    DEMO_BRANCHES.forEach((b, bi) => {
      const choiceCode = demoChoiceCode(c.code, bi);
      branches.set(choiceCode, { authority: "MH-CET-CELL", exam: "MHT-CET", choiceCode, collegeCode: c.code, name: b });
      const rows: CutoffRow[] = [];
      seatTypesFor(c).forEach(({ seatType, section }, si) => {
        ROUNDS.forEach((round, ri) => {
          rows.push({
            authority: "MH-CET-CELL", exam: "MHT-CET", year: DEMO_YEAR, list: "MH", round,
            choiceCode, collegeCode: c.code, section, seatType, stage: "I",
            closingMerit: closingMerit(ci, bi, si, ri), closingPercentile: null,
            sourceFile: `demo-cutoff-list-round-${round}-MH.pdf`, sourcePage: 10 + ci * 4 + bi,
          });
        });
      });
      ROUNDS.forEach((round, ri) => {
        rows.push({
          authority: "MH-CET-CELL", exam: "JEE(Main)-2026", year: DEMO_YEAR, list: "AI", round,
          choiceCode, collegeCode: c.code, section: "AI to AI", seatType: "AI", stage: "",
          closingMerit: closingMerit(ci, bi, 0, ri) * 3, closingPercentile: null,
          sourceFile: `demo-cutoff-list-round-${round}-AI.pdf`, sourcePage: 4 + ci,
        });
      });
      cutoffsByChoiceCode.set(choiceCode, rows);
    });
  });

  return { year: DEMO_YEAR, colleges, branches, cutoffsByChoiceCode };
}
