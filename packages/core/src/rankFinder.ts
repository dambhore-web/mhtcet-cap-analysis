import type { CutoffRow } from "./types.ts";
import type { Round } from "./rounds.ts";
import { roundNumber } from "./rounds.ts";
import { parseSeatType } from "./seatType.ts";
import { eligibleSeatTypes, type CandidateProfile, type CollegeEligibilityContext } from "./eligibility.ts";

/** Section labels as printed on the MH official cutoff lists. */
const MH_SECTION: Record<string, string> = {
  S: "State Level",
  H: "Home University Seats Allotted to Home University Candidates",
  O: "Other Than Home University Seats Allotted to Other Than Home University Candidates",
};

const MI_SECTION = "Minority Seats Allotted to Maharashtra State Candidature Candidates";
const AI_SECTION = "AI to AI";

export type RankStatus = "round-I" | "later-round" | "out-of-range";

export interface RankOption {
  seatType: string;
  status: RankStatus;
  /** The round whose closing merit decided this status. */
  round: Round;
  closingMerit: number;
}

export interface RankFinderResult {
  /** Best option across all eligible seat types (round-I > later-round > out-of-range). null if no cutoff data. */
  best: RankOption | null;
  /** One entry per eligible seat type that had at least one cutoff row. */
  options: RankOption[];
}

const STATUS_ORDER: Record<RankStatus, number> = { "round-I": 0, "later-round": 1, "out-of-range": 2 };

/**
 * Pure rank-finder: given a candidate, a college context and the cutoff rows for one
 * choice code (college + branch), returns match status per eligible seat type.
 *
 * cutoffRows should be pre-filtered to the relevant choice code (and year).
 * Rows from both MH and AI lists may be passed; the function selects the correct list.
 */
export function rankFind(
  candidate: CandidateProfile,
  college: CollegeEligibilityContext,
  cutoffRows: readonly CutoffRow[],
): RankFinderResult {
  const eligible = eligibleSeatTypes(candidate, college);
  const list = candidate.candidature === "AI" ? "AI" : "MH";
  const listRows = cutoffRows.filter((r) => r.list === list);

  const options: RankOption[] = [];

  for (const seatTypeCode of eligible) {
    const parsed = parseSeatType(seatTypeCode);
    if (!parsed) continue;

    let section: string;
    let stageFilter: string | null;

    if (parsed.kind === "standalone") {
      switch (parsed.standalone) {
        case "AI":
          section = AI_SECTION;
          stageFilter = null;
          break;
        case "MI":
          section = MI_SECTION;
          stageFilter = "I";
          break;
        default:
          // EWS, TFWS, ORPHANI, ORPHANN — state-level standalone seats
          section = "State Level";
          stageFilter = "I";
      }
    } else {
      section = MH_SECTION[parsed.level] ?? "State Level";
      // Male candidates compete for ladies seats only in Stage II
      stageFilter = parsed.ladies && candidate.gender === "M" ? "II" : "I";
    }

    const rows = listRows.filter((r) => {
      if (r.seatType !== seatTypeCode) return false;
      if (r.section !== section) return false;
      if (stageFilter !== null && r.stage !== stageFilter) return false;
      return true;
    });

    if (rows.length === 0) continue;

    const option = deriveStatus(candidate.meritNumber, rows);
    if (option) options.push({ seatType: seatTypeCode, ...option });
  }

  let best: RankOption | null = null;
  for (const opt of options) {
    if (!best || STATUS_ORDER[opt.status] < STATUS_ORDER[best.status]) best = opt;
  }

  return { best, options };
}

/**
 * Applies the three-tier round logic for a single seat type:
 *   merit ≤ Round I closing          → "round-I"
 *   merit ≤ max closing of Rounds II–IV → "later-round" (names that round)
 *   otherwise                        → "out-of-range" (shows loosest closing)
 *
 * Values are never carried across rounds — only rounds where the seat type
 * actually appears in the list are considered.
 */
function deriveStatus(
  meritNumber: number,
  rows: readonly CutoffRow[],
): Omit<RankOption, "seatType"> | null {
  if (rows.length === 0) return null;

  const roundIRows = rows.filter((r) => r.round === "I");
  if (roundIRows.length > 0) {
    const closing = Math.min(...roundIRows.map((r) => r.closingMerit));
    if (meritNumber <= closing) return { status: "round-I", round: "I", closingMerit: closing };
  }

  const laterRows = rows.filter((r) => {
    const n = roundNumber(r.round);
    return n >= 2 && n <= 4;
  });
  if (laterRows.length > 0) {
    const best = laterRows.reduce((a, b) => (b.closingMerit > a.closingMerit ? b : a));
    if (meritNumber <= best.closingMerit) {
      return { status: "later-round", round: best.round, closingMerit: best.closingMerit };
    }
  }

  // Out of range — show loosest closing across all rounds
  const allRows = [...roundIRows, ...laterRows];
  if (allRows.length === 0) return null;
  const loosest = allRows.reduce((a, b) => (b.closingMerit > a.closingMerit ? b : a));
  return { status: "out-of-range", round: loosest.round, closingMerit: loosest.closingMerit };
}
