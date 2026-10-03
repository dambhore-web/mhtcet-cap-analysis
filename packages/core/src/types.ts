import type { Round } from "./rounds.ts";
import type { AuthorityId } from "./authority.ts";

/** One seat holder in one institute-wise allotment list. No name, no application ID (ADR-003). */
export interface AllotmentRow {
  year: number;
  round: Round;
  collegeCode: string;
  /** 10-digit choice code, may carry suffix letters (e.g. `T` for a TFWS list). */
  choiceCode: string;
  branch: string;
  section: string;
  merit: number | null;
  score: number | null;
  gender: string | null;
  category: string | null;
  seatType: string | null;
}

/** Branch header block from an allotment list, with the printed seat counts. */
export interface AllotmentBranch {
  round: Round;
  collegeCode: string;
  choiceCode: string;
  branch: string;
  sanctionIntake: number | null;
  capSeats: number | null;
  msSeats: number | null;
  minoritySeats: number | null;
  aiSeats: number | null;
  /** Candidate rows parsed under this header. */
  parsedRows: number;
  /** Rows printed as `VACANT` (a CAP seat with no holder). */
  vacantRows: number;
  /** Candidate rows per seat type. */
  rowsBySeatType: Record<string, number>;
  /** VACANT rows per seat type. */
  vacantBySeatType: Record<string, number>;
}

/** Which official cutoff list a row came from. */
export type CutoffList = "MH" | "AI" | "Diploma";

/**
 * One cell of an official cutoff list.
 * Natural key: (authority, exam, year, list, round, choiceCode, section, seatType, stage).
 */
export interface CutoffRow {
  authority: AuthorityId;
  /**
   * Merit basis of the value. MH lists: `MHT-CET` (state general merit). AI / Diploma lists:
   * the "Merit Exam" printed on the row (e.g. `JEE`, `JEE(Main)-2026`, `MHT-CET`, `Diploma/ D.voc`).
   */
  exam: string;
  year: number;
  list: CutoffList;
  round: Round;
  collegeCode: string;
  choiceCode: string;
  /** MH: printed section label. AI: printed type (`AI to AI`, `MH to AI` …). Diploma: `Diploma`. */
  section: string;
  /** Printed seat-type code; empty for the Diploma list, which prints none. */
  seatType: string;
  /** MH: printed stage label (`I`, `II`, `I-Non PWD` …); empty for AI / Diploma lists. */
  stage: string;
  closingMerit: number;
  closingPercentile: number | null;
  sourceFile: string;
  sourcePage: number;
}

export interface College {
  authority: AuthorityId;
  /** Admission process the college takes part in (e.g. `MHT-CET` for Maharashtra FE CAP). */
  exam: string;
  code: string;
  name: string;
  status: string | null;
  homeUniversity: string | null;
  totalIntake: number | null;
  /** District from the official institute list; null until loaded (migration 002). */
  district?: string | null;
  /** Government, Government-aided, Unaided, Autonomous, University department …; null until loaded. */
  collegeType?: string | null;
}

export interface Branch {
  authority: AuthorityId;
  exam: string;
  choiceCode: string;
  collegeCode: string;
  name: string;
}

export type MeritExam = "JEE" | "MHT-CET-PCM" | "Diploma" | "D.Voc.";

/** One row of an All India merit list. No name, no application ID. */
export interface MeritRow {
  merit: number;
  exam: MeritExam;
  score: number;
}
