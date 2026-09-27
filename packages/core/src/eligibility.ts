import type { Category, LevelCode } from "./seatType.ts";

export interface CandidateProfile {
  candidature: "MH" | "AI";
  /** University area where the qualifying exam was passed. null for AI candidates. */
  homeUniversity: string | null;
  /** Reserved category (SC/ST/OBC/…). null means Open — no reservation. */
  category: Category | null;
  gender: "M" | "F";
  ews: boolean;
  tfws: boolean;
  defence: boolean;
  pwd: boolean;
  orphan: boolean;
  /** Candidate's minority community (e.g. "Muslim"). null if not a minority candidate. */
  minorityCommunity: string | null;
  /** Lower number = better rank. MH candidates: MHT-CET state merit; AI candidates: JEE rank. */
  meritNumber: number;
  subjectGroup: "PCM" | "PCB";
}

export interface CollegeEligibilityContext {
  /** Affiliating university of the college. null for Autonomous Institutes (State Level seats only). */
  homeUniversity: string | null;
  /** Minority community for a minority institution, or null if it is not a minority college. */
  minorityCommunity: string | null;
}

/**
 * Returns all seat-type codes a candidate may be matched against at a specific college.
 *
 * Ladies seats (L…) are included for male candidates because males compete for vacant
 * ladies seats in Stage II (brochure rule 10 Stage II). The rank finder filters those rows
 * on stage "II" while all other seat types use stage "I".
 *
 * Pure — no DB access.
 */
export function eligibleSeatTypes(
  candidate: CandidateProfile,
  college: CollegeEligibilityContext,
): string[] {
  if (candidate.candidature === "AI") return ["AI"];

  const codes: string[] = [];

  // S is always available. Non-autonomous colleges also have H or O depending on HU match.
  const levels: LevelCode[] = ["S"];
  if (college.homeUniversity !== null) {
    levels.push(candidate.homeUniversity === college.homeUniversity ? "H" : "O");
  }

  function addLevels(quota: string, cat: string) {
    for (const lvl of levels) codes.push(`${quota}${cat}${lvl}`);
  }

  // General open seats (every MH candidate)
  addLevels("G", "OPEN");

  // Reserved category (if any)
  if (candidate.category !== null) {
    addLevels("G", candidate.category);
  }

  // Ladies seats — female Stage I, male Stage II
  addLevels("L", "OPEN");
  if (candidate.category !== null) {
    addLevels("L", candidate.category);
  }

  // PWD
  if (candidate.pwd) {
    addLevels("PWD", "OPEN");
    addLevels("PWDR", "OPEN");
    if (candidate.category !== null) {
      addLevels("PWD", candidate.category);
      addLevels("PWDR", candidate.category);
    }
  }

  // Defence
  if (candidate.defence) {
    addLevels("DEF", "OPEN");
    addLevels("DEFR", "OPEN");
    if (candidate.category !== null) {
      addLevels("DEF", candidate.category);
      addLevels("DEFR", candidate.category);
    }
  }

  // Standalone quota codes (no level suffix)
  if (candidate.ews) codes.push("EWS");
  if (candidate.tfws) codes.push("TFWS");
  if (candidate.orphan) {
    codes.push("ORPHANI");
    codes.push("ORPHANN");
  }

  // Minority seats — only when candidate community matches college community
  if (
    candidate.minorityCommunity !== null &&
    college.minorityCommunity !== null &&
    candidate.minorityCommunity.toLowerCase() === college.minorityCommunity.toLowerCase()
  ) {
    codes.push("MI");
  }

  return [...new Set(codes)];
}
