import type { AppCache, HistoryRow, PlacementClaimRow, PlacementRow } from "../startup.ts";
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

/**
 * Invented earlier years for the demo: three rounds in 2023–2024, four in 2025, with closing ranks
 * that drift by college and branch so some branches get harder and some easier over the years.
 */
function demoHistory(ci: number, bi: number, seatTypes: string[]): HistoryRow[] {
  const out: HistoryRow[] = [];
  for (const [yi, year] of [DEMO_YEAR - 3, DEMO_YEAR - 2, DEMO_YEAR - 1].entries()) {
    const drift = 1 + ((bi % 2 === 0 ? 0.07 : -0.05) * (3 - yi));
    const rounds = year < DEMO_YEAR - 1 ? ROUNDS.slice(0, 3) : ROUNDS;
    seatTypes.forEach((seatType, si) => {
      rounds.forEach((round, ri) => {
        out.push({
          year, round, seatType, section: "State Level", stage: "I",
          closingMerit: Math.round(closingMerit(ci, bi, si, ri) * drift), closingPercentile: null,
        });
      });
    });
  }
  return out;
}

export function demoChoiceCode(collegeCode: string, branchIndex: number): string {
  return `${collegeCode}${String(branchIndex + 1).padStart(2, "0")}910`;
}

export function demoCache(): AppCache {
  const colleges = new Map<string, College>();
  const branches = new Map<string, Branch>();
  const cutoffsByChoiceCode = new Map<string, CutoffRow[]>();
  const history = new Map<string, HistoryRow[]>();
  const seats = new Map<string, Map<string, number>>();

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
      history.set(choiceCode, demoHistory(ci, bi, seatTypesFor(c).map((s) => s.seatType)));
      // Invented seat matrix: a few seats per seat type (some pools of 1–2), plus All India and TFWS.
      const bySeat = new Map<string, number>();
      seatTypesFor(c).forEach(({ seatType }, si) => bySeat.set(seatType, Math.max(1, 14 - si * 3 - bi * 2)));
      bySeat.set("AI", 9 - bi);
      bySeat.set("TFWS", 3);
      seats.set(choiceCode, bySeat);
    });
  });

  return { year: DEMO_YEAR, colleges, branches, cutoffsByChoiceCode, history, seats, placement: demoPlacement(), placementClaims: demoPlacementClaims() };
}

/** Invented NIRF-style placement for the first two demo colleges (the others show none). */
function demoPlacement(): Map<string, PlacementRow[]> {
  const placement = new Map<string, PlacementRow[]>();
  DEMO_COLLEGES.slice(0, 2).forEach((c, ci) => {
    placement.set(c.code, ["2022-23", "2023-24", "2024-25"].map((graduationYear, i) => ({
      graduationYear,
      graduates: 600 - ci * 100 + i * 10,
      placed: 450 - ci * 80 + i * 15,
      medianSalary: 800_000 - ci * 150_000 + i * 50_000,
      higherStudies: 60 - i * 5,
      nirfYear: 2026,
      nirfCategory: "Engineering",
      sourceUrl: `https://example.org/demo-nirf-${c.code}.pdf`,
    })));
  });
  return placement;
}

/** Invented website figures: the first demo college also has NIRF data, the third has only these. */
function demoPlacementClaims(): Map<string, PlacementClaimRow> {
  const claims = new Map<string, PlacementClaimRow>();
  [DEMO_COLLEGES[0], DEMO_COLLEGES[2]].forEach((c, i) => {
    const sourceUrl = `https://example.org/demo-placements-${c.code}`;
    claims.set(c.code, {
      year: "2025-26", highest: 4_400_000 - i * 1_000_000, average: 900_000 - i * 100_000, median: i ? null : 800_000, placedPct: 88 - i * 3,
      crawledAt: "2026-09-29",
      claims: [{ metric: "highest", value: 4_400_000 - i * 1_000_000, year: "2025-26", snippet: "Highest package 44 LPA", sourceUrl }],
    });
  });
  return claims;
}
