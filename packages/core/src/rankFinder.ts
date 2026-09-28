import type { CutoffRow } from "./types.ts";
import type { Round } from "./rounds.ts";
import { roundNumber } from "./rounds.ts";
import { parseSeatType } from "./seatType.ts";
import { eligibleSeatTypes, type CandidateProfile, type CollegeEligibilityContext } from "./eligibility.ts";

/**
 * Normalises the stage label printed on a cutoff row to one of the canonical values
 * used by rank-finder logic ("I", "II", null).
 *
 * The CET Cell sometimes prints extended labels on the same row:
 *   "I-Non PWD"       → "I"   (Stage I seats after PWD reserved quota is filled)
 *   "I-Non Defence"   → "I"   (Stage I seats after Defence reserved quota is filled)
 *   "II-Non …"        → "II"  (same pattern for Stage II)
 *
 * Unknown codes (e.g. "VII", "MH") are left as-is so they fall through the filter
 * and are logged separately for investigation.
 */
export function normalizeStage(stage: string): string {
  if (stage === "I" || stage.startsWith("I-")) return "I";
  if (stage === "II" || stage.startsWith("II-")) return "II";
  return stage;
}

/** Section labels as printed on the MH official cutoff lists. */
const MH_SECTION: Record<string, string> = {
  S: "State Level",
  H: "Home University Seats Allotted to Home University Candidates",
  O: "Other Than Home University Seats Allotted to Other Than Home University Candidates",
};

const MI_SECTION = "Minority Seats Allotted to Maharashtra State Candidature Candidates";
const AI_SECTION = "AI to AI";

export type RankStatus = "round-I" | "later-round" | "out-of-range";

/** The closing merit of one seat type in one round, with the official list it came from. */
export interface RoundClosing {
  round: Round;
  closingMerit: number;
  sourceFile: string | null;
  sourcePage: number | null;
}

export interface RankOption {
  seatType: string;
  status: RankStatus;
  /** The round whose closing merit decided this status. */
  round: Round;
  closingMerit: number;
  /** Closing merit in every published round for this seat type, Round I first. */
  rounds: RoundClosing[];
}

export interface RankFinderResult {
  /** Best option across all eligible seat types (round-I > later-round > out-of-range). null if no cutoff data. */
  best: RankOption | null;
  /** One entry per eligible seat type that had at least one cutoff row. */
  options: RankOption[];
}

const STATUS_ORDER: Record<RankStatus, number> = { "round-I": 0, "later-round": 1, "out-of-range": 2 };

/** Seat-type codes are a small fixed set, so parse each once (results are read-only). */
const PARSED = new Map<string, ReturnType<typeof parseSeatType>>();
function parsedSeatType(code: string) {
  let p = PARSED.get(code);
  if (p === undefined) {
    p = parseSeatType(code);
    if (PARSED.size < 1000) PARSED.set(code, p);
  }
  return p;
}

/** Everything rankFind needs about one seat type's rows, worked out once per set of rows. */
interface SeatSummary {
  /** Tightest Round I closing, or null when the seat type has no Round I row. */
  roundI: number | null;
  /** Loosest Rounds II–IV row (first one wins a tie). */
  laterBest: CutoffRow | null;
  /** Loosest row across Round I and Rounds II–IV, Round I first on a tie: the out-of-range value. */
  loosest: CutoffRow | null;
  rounds: RoundClosing[];
}

/** Rows grouped by list, seat type, section and stage ("*" = any stage). */
type CutoffIndex = Map<string, SeatSummary>;

const key = (list: string, seatType: string, section: string, stage: string) => `${list}|${seatType}|${section}|${stage}`;

function summarise(rows: readonly CutoffRow[]): SeatSummary {
  let roundI: number | null = null;
  let roundILoosest: CutoffRow | null = null;
  let laterBest: CutoffRow | null = null;
  for (const r of rows) {
    if (r.round === "I") {
      if (roundI === null || r.closingMerit < roundI) roundI = r.closingMerit;
      if (!roundILoosest || r.closingMerit > roundILoosest.closingMerit) roundILoosest = r;
      continue;
    }
    const n = roundNumber(r.round);
    if (n >= 2 && n <= 4 && (!laterBest || r.closingMerit > laterBest.closingMerit)) laterBest = r;
  }
  const loosest = roundILoosest && (!laterBest || roundILoosest.closingMerit >= laterBest.closingMerit) ? roundILoosest : laterBest;
  return { roundI, laterBest, loosest, rounds: roundClosings(rows) };
}

function buildIndex(cutoffRows: readonly CutoffRow[]): CutoffIndex {
  const groups = new Map<string, CutoffRow[]>();
  const add = (k: string, r: CutoffRow) => {
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  };
  for (const r of cutoffRows) {
    add(key(r.list, r.seatType, r.section, normalizeStage(r.stage)), r);
    add(key(r.list, r.seatType, r.section, "*"), r);
  }
  const index: CutoffIndex = new Map();
  for (const [k, rows] of groups) index.set(k, summarise(rows));
  return index;
}

/**
 * The index for a set of rows, built on first use. The API's cache keeps one array per choice
 * code for its lifetime, so each branch is summarised once, not on every search.
 */
const INDEXES = new WeakMap<readonly CutoffRow[], CutoffIndex>();
function indexFor(cutoffRows: readonly CutoffRow[]): CutoffIndex {
  let index = INDEXES.get(cutoffRows);
  if (!index) {
    index = buildIndex(cutoffRows);
    INDEXES.set(cutoffRows, index);
  }
  return index;
}

/** The index key each eligible seat type is looked up by (null: not a seat type). */
function seatKey(seatTypeCode: string, list: string, gender: "M" | "F"): string | null {
  const parsed = parsedSeatType(seatTypeCode);
  if (!parsed) return null;
  if (parsed.kind === "standalone") {
    switch (parsed.standalone) {
      case "AI":
        return key(list, seatTypeCode, AI_SECTION, "*");
      case "MI":
        return key(list, seatTypeCode, MI_SECTION, "I");
      default:
        // EWS, TFWS, ORPHANI, ORPHANN — state-level standalone seats
        return key(list, seatTypeCode, "State Level", "I");
    }
  }
  // Male candidates compete for ladies seats only in Stage II
  return key(list, seatTypeCode, MH_SECTION[parsed.level] ?? "State Level", parsed.ladies && gender === "M" ? "II" : "I");
}

/**
 * Keys for a whole eligible list. Callers that pass the same eligible array for every branch of
 * a college reuse the same key strings, so the lookups don't rebuild and rehash them per branch.
 */
const KEYS = new WeakMap<readonly string[], Map<string, (string | null)[]>>();
function lookupKeys(eligible: readonly string[], list: string, gender: "M" | "F"): (string | null)[] {
  let byVariant = KEYS.get(eligible);
  if (!byVariant) KEYS.set(eligible, (byVariant = new Map()));
  const variant = list + gender;
  let keys = byVariant.get(variant);
  if (!keys) byVariant.set(variant, (keys = eligible.map((code) => seatKey(code, list, gender))));
  return keys;
}

/**
 * Pure rank-finder: given a candidate, a college context and the cutoff rows for one
 * choice code (college + branch), returns match status per eligible seat type.
 *
 * cutoffRows should be pre-filtered to the relevant choice code (and year).
 * Rows from both MH and AI lists may be passed; the function selects the correct list.
 * Treat the rows as read-only: a summary of them is cached against the array.
 */
export function rankFind(
  candidate: CandidateProfile,
  college: CollegeEligibilityContext,
  cutoffRows: readonly CutoffRow[],
  /** Precomputed eligibleSeatTypes(candidate, college); callers looping over many branches pass it once per college. */
  eligibleTypes?: readonly string[],
): RankFinderResult {
  const eligible = eligibleTypes ?? eligibleSeatTypes(candidate, college);
  const list = candidate.candidature === "AI" ? "AI" : "MH";
  const index = indexFor(cutoffRows);
  const merit = candidate.meritNumber;

  const options: RankOption[] = [];
  const keys = lookupKeys(eligible, list, candidate.gender);

  for (let i = 0; i < eligible.length; i++) {
    const k = keys[i];
    const seat = k === null ? undefined : index.get(k);
    if (!seat) continue;

    const option = deriveStatus(merit, seat);
    if (option) options.push({ seatType: eligible[i], ...option, rounds: seat.rounds });
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
function deriveStatus(meritNumber: number, seat: SeatSummary): Omit<RankOption, "seatType" | "rounds"> | null {
  if (seat.roundI !== null && meritNumber <= seat.roundI) return { status: "round-I", round: "I", closingMerit: seat.roundI };
  if (seat.laterBest && meritNumber <= seat.laterBest.closingMerit) {
    return { status: "later-round", round: seat.laterBest.round, closingMerit: seat.laterBest.closingMerit };
  }
  // Out of range — show loosest closing across all rounds
  if (!seat.loosest) return null;
  return { status: "out-of-range", round: seat.loosest.round, closingMerit: seat.loosest.closingMerit };
}

/**
 * One value per round, Round I first. Round I keeps the tightest value and later rounds the
 * loosest, matching deriveStatus. The row's source file and page travel with the value (NFR-001).
 */
export function roundClosings(rows: readonly CutoffRow[]): RoundClosing[] {
  // Indexed by round number: rows per seat type are few, so a small array beats a Map and a sort
  const byRound: (CutoffRow | undefined)[] = [];
  for (const r of rows) {
    const n = roundNumber(r.round);
    const cur = byRound[n];
    const better = !cur || (r.round === "I" ? r.closingMerit < cur.closingMerit : r.closingMerit > cur.closingMerit);
    if (better) byRound[n] = r;
  }
  const out: RoundClosing[] = [];
  for (const r of byRound) {
    if (r) out.push({ round: r.round, closingMerit: r.closingMerit, sourceFile: r.sourceFile ?? null, sourcePage: r.sourcePage ?? null });
  }
  return out;
}
