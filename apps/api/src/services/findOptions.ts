import { eligibleSeatTypes, rankFind, type CandidateProfile, type CollegeEligibilityContext } from "@mhtcet/core";
import { type AppCache, minorityCommunity } from "../startup.ts";

export interface FindOptionsRequest {
  year: number;
  merit: number;
  candidature: "MH" | "AI";
  homeUniversity: string | null;
  category: CandidateProfile["category"];
  gender: "M" | "F";
  minorityCommunity: string | null;
  flags: { ews: boolean; tfws: boolean; defence: boolean; pwd: boolean; orphan: boolean };
  subjectGroup: "PCM" | "PCB";
  filters: { university: string | null; district: string | null; collegeType: string | null; branchGroup: string | null; branch: string | null };
}

export const BRANCH_GROUP_PATTERNS: Record<string, RegExp> = {
  "Computer & IT":        /computer|information\s+tech|data\s+sc|artificial\s+int|machine\s+learn|cyber/i,
  "Electronics & Telecom": /electronics|e\.?\s*t\.?\s*c|telecom/i,
  "Mechanical":           /mechanical/i,
  "Civil":                /civil/i,
  "Electrical":           /electrical/i,
  "Chemical":             /chemical|petroleum|plastic/i,
  "Instrumentation":      /instrument/i,
  "Aerospace":            /aeronautical|aerospace/i,
};

const STATUS_ORDER = { "round-I": 0, "later-round": 1, "out-of-range": 2 } as const;

export interface FoundOption {
  collegeCode: string;
  collegeName: string;
  district: string | null;
  collegeType: string | null;
  choiceCode: string;
  branch: string;
  list: "MH" | "AI";
  seatType: string;
  status: keyof typeof STATUS_ORDER;
  round: string;
  closingMerit: number;
  firstRoundClosing: number | null;
  lastRoundClosing: number | null;
  rounds: { round: string; closingMerit: number }[];
  source: { file: string | null; page: number | null } | null;
  year: number;
  /**
   * The same branch and seat type in earlier CAP years (state list only), oldest first: Round I and
   * last-round closing ranks. Empty for All India options and when the seat type did not exist.
   */
  pastYears: PastYear[];
}

export interface PastYear {
  year: number;
  firstRoundClosing: number | null;
  lastRoundClosing: number;
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

/** Round I and last-round closing ranks per earlier year for one branch and seat type. */
export function pastYears(cache: AppCache, choiceCode: string, seatType: string): PastYear[] {
  const byYear = new Map<number, Map<string, number>>();
  for (const r of cache.history.get(choiceCode) ?? []) {
    if (r.seatType !== seatType) continue;
    const rounds = byYear.get(r.year) ?? new Map<string, number>();
    if (!rounds.has(r.round)) rounds.set(r.round, r.closingMerit); // first printed stage, as elsewhere
    byYear.set(r.year, rounds);
  }
  return [...byYear]
    .sort(([a], [b]) => a - b)
    .map(([year, rounds]) => {
      const ordered = [...rounds].sort(([a], [b]) => (ROMAN[a] ?? 9) - (ROMAN[b] ?? 9));
      return { year, firstRoundClosing: rounds.get("I") ?? null, lastRoundClosing: ordered[ordered.length - 1][1] };
    });
}

/** The rank finder over the whole cache: used by POST /api/rank-finder and the assistant's findOptions tool. */
export function findOptions(cache: AppCache, req: FindOptionsRequest): FoundOption[] {
  const candidate: CandidateProfile = {
    candidature: req.candidature,
    homeUniversity: req.homeUniversity,
    category: req.category,
    gender: req.gender,
    ews: req.flags.ews,
    tfws: req.flags.tfws,
    defence: req.flags.defence,
    pwd: req.flags.pwd,
    orphan: req.flags.orphan,
    minorityCommunity: req.minorityCommunity,
    meritNumber: req.merit,
    subjectGroup: req.subjectGroup,
  };

  const options: FoundOption[] = [];

  const { university, district, collegeType, branchGroup, branch: branchName } = req.filters;
  // Eligibility depends only on the candidate and the college, so work it out once per college
  const eligibleByCollege = new Map<string, { ctx: CollegeEligibilityContext; types: string[] }>();

  for (const [choiceCode, cutoffs] of cache.cutoffsByChoiceCode) {
    const branch = cache.branches.get(choiceCode);
    if (!branch) continue;
    const college = cache.colleges.get(branch.collegeCode);
    if (!college) continue;

    // Result filters — applied before the eligibility/rank computation
    if (university && college.homeUniversity !== university) continue;
    if (district && college.district !== district) continue;
    if (collegeType && college.collegeType !== collegeType) continue;
    if (branchName && branch.name.toLowerCase() !== branchName.toLowerCase()) continue;
    if (!branchName && branchGroup) {
      const pattern = BRANCH_GROUP_PATTERNS[branchGroup];
      if (pattern && !pattern.test(branch.name)) continue;
    }

    let eligible = eligibleByCollege.get(college.code);
    if (!eligible) {
      const ctx: CollegeEligibilityContext = {
        homeUniversity: college.homeUniversity,
        minorityCommunity: minorityCommunity(college.status),
      };
      eligible = { ctx, types: eligibleSeatTypes(candidate, ctx) };
      eligibleByCollege.set(college.code, eligible);
    }

    const result = rankFind(candidate, eligible.ctx, cutoffs, eligible.types);
    if (!result.best) continue;

    const best = result.best;
    const deciding = best.rounds.find((r) => r.round === best.round) ?? null;
    options.push({
      collegeCode: branch.collegeCode,
      collegeName: college.name,
      district: college.district ?? null,
      collegeType: college.collegeType ?? null,
      choiceCode,
      branch: branch.name,
      list: req.candidature,
      seatType: best.seatType,
      status: best.status,
      round: best.round,
      closingMerit: best.closingMerit,
      firstRoundClosing: best.rounds[0]?.round === "I" ? best.rounds[0].closingMerit : null,
      lastRoundClosing: best.rounds.at(-1)?.closingMerit ?? null,
      rounds: best.rounds.map((r) => ({ round: r.round, closingMerit: r.closingMerit })),
      source: deciding ? { file: deciding.sourceFile, page: deciding.sourcePage } : null,
      year: req.year,
      pastYears: req.candidature === "MH" ? pastYears(cache, choiceCode, best.seatType) : [],
    });
  }

  options.sort((a, b) => {
    const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (sd !== 0) return sd;
    // Within the same status, lower closing merit (more competitive) first.
    return a.closingMerit - b.closingMerit;
  });

  return options;
}
