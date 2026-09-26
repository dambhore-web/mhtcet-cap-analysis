import type { CutoffRow } from "@mhtcet/core";

export interface CheckResult {
  name: string;
  /** Blocking checks stop the load (globally, or for the failing colleges). */
  blocking: boolean;
  pass: boolean;
  summary: string;
  details?: unknown;
}

export interface RunReport {
  kind: "validation" | "load";
  year: number;
  createdAt: string;
  gitCommit: string | null;
  checks: CheckResult[];
  load: {
    allowed: boolean;
    blockedBy: string[];
    cutoffs: { excludedFiles: string[]; excludedColleges: string[]; excludedKeys: string[] };
    merit: { allowed: boolean };
  };
}

/** Natural key of a cutoff row: (authority, exam, year, list, round, choice_code, section, seat_type, stage). */
export function cutoffKey(c: Pick<CutoffRow, "authority" | "exam" | "year" | "list" | "round" | "choiceCode" | "section" | "seatType" | "stage">): string {
  return [c.authority, c.exam, c.year, c.list, c.round, c.choiceCode, c.section, c.seatType, c.stage].join("|");
}

/** True when the text contains an application ID (EN + 8 digits). */
export function findPersonalData(text: string): boolean {
  return /EN\d{8}/.test(text);
}
