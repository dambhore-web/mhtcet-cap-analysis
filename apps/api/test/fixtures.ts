import type { AppCache } from "../src/startup.ts";
import type { College, Branch, CutoffRow } from "@mhtcet/core";

/** Minimal seeded cache used by integration tests — no real DB needed. */
export function seedCache(): AppCache {
  const colleges = new Map<string, College>();
  const branches = new Map<string, Branch>();
  const cutoffsByChoiceCode = new Map<string, CutoffRow[]>();

  // College: VJTI Mumbai
  colleges.set("1002", {
    authority: "MH-CET-CELL",
    exam: "MHT-CET",
    code: "1002",
    name: "Veermata Jijabai Technological Institute, Mumbai",
    status: null,
    homeUniversity: "University of Mumbai",
    totalIntake: 640,
  });

  // College: Generic Pune college
  colleges.set("5002", {
    authority: "MH-CET-CELL",
    exam: "MHT-CET",
    code: "5002",
    name: "Pune Engineering College",
    status: null,
    homeUniversity: "Savitribai Phule Pune University",
    totalIntake: 240,
  });

  // Branch: Computer Engineering at VJTI (choice code 1002119110)
  branches.set("1002119110", {
    authority: "MH-CET-CELL",
    exam: "MHT-CET",
    choiceCode: "1002119110",
    collegeCode: "1002",
    name: "Computer Engineering",
  });

  // Branch: Computer Engineering at Pune college
  branches.set("5002119110", {
    authority: "MH-CET-CELL",
    exam: "MHT-CET",
    choiceCode: "5002119110",
    collegeCode: "5002",
    name: "Computer Engineering",
  });

  // Cutoff rows for VJTI Computer Engineering
  // Candidate has homeUniversity "University of Mumbai" = VJTI's HU, so eligible for GOPENH (H-level)
  const vjtiCutoffs: CutoffRow[] = [
    {
      authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH",
      round: "I", choiceCode: "1002119110", collegeCode: "1002",
      section: "Home University Seats Allotted to Home University Candidates",
      seatType: "GOPENH",
      stage: "I", closingMerit: 150, closingPercentile: null,
      sourceFile: "test", sourcePage: 1,
    },
    {
      authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH",
      round: "II", choiceCode: "1002119110", collegeCode: "1002",
      section: "Home University Seats Allotted to Home University Candidates",
      seatType: "GOPENH",
      stage: "I", closingMerit: 175, closingPercentile: null,
      sourceFile: "test", sourcePage: 1,
    },
  ];
  cutoffsByChoiceCode.set("1002119110", vjtiCutoffs);

  // Cutoff rows for Pune college Computer Engineering
  // Candidate's HU is Mumbai ≠ Pune HU, so eligible for GOPENO (O-level, other-than-home-university)
  const puneCutoffs: CutoffRow[] = [
    {
      authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH",
      round: "I", choiceCode: "5002119110", collegeCode: "5002",
      section: "Other Than Home University Seats Allotted to Other Than Home University Candidates",
      seatType: "GOPENO",
      stage: "I", closingMerit: 8500, closingPercentile: null,
      sourceFile: "test", sourcePage: 1,
    },
    {
      authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH",
      round: "II", choiceCode: "5002119110", collegeCode: "5002",
      section: "Other Than Home University Seats Allotted to Other Than Home University Candidates",
      seatType: "GOPENO",
      stage: "I", closingMerit: 9200, closingPercentile: null,
      sourceFile: "test", sourcePage: 1,
    },
  ];
  cutoffsByChoiceCode.set("5002119110", puneCutoffs);

  return { year: 2026, colleges, branches, cutoffsByChoiceCode, history: new Map() };
}

/** A pool stub that always throws — forces merit-estimate to the statistical fallback. */
export const stubPool = {
  query: async () => { throw new Error("no test DB"); },
} as never;
