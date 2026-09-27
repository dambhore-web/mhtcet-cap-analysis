import type { Context } from "hono";
import { z } from "zod";
import { CATEGORIES, rankFind, type CandidateProfile, type CollegeEligibilityContext } from "@mhtcet/core";
import { type AppCache, minorityCommunity } from "../startup.ts";
import type { Round } from "@mhtcet/core";

const FlagsSchema = z.object({
  ews: z.boolean().default(false),
  tfws: z.boolean().default(false),
  defence: z.boolean().default(false),
  pwd: z.boolean().default(false),
  orphan: z.boolean().default(false),
}).default({});

const RequestSchema = z.object({
  year: z.number().int().min(2023).max(2030).default(2026),
  merit: z.number().int().min(1),
  homeUniversity: z.string().nullable().default(null),
  category: z.enum(CATEGORIES).nullable().default(null),
  gender: z.enum(["M", "F"]),
  minorityCommunity: z.string().nullable().default(null),
  flags: FlagsSchema,
  subjectGroup: z.enum(["PCM", "PCB"]).default("PCM"),
  /** Ordered preference list — first choice first. Max 300. */
  preferences: z.array(z.string().min(1)).min(1).max(300),
});

const ROUNDS: Round[] = ["I", "II", "III"];

export interface SimulatedAllotment {
  round: Round;
  rank: number;
  choiceCode: string;
  collegeName: string;
  branch: string;
  seatType: string;
  closingMerit: number;
}

/** POST /api/simulate */
export async function postSimulate(c: Context, cache: AppCache) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_request", details: parsed.error.format() }, 400);
  }

  const req = parsed.data;

  if (req.year !== cache.year) {
    return c.json({ error: "year_not_loaded", message: `Only year ${cache.year} is available` }, 404);
  }

  const candidate: CandidateProfile = {
    candidature: "MH",
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

  const allotments: SimulatedAllotment[] = [];

  for (const round of ROUNDS) {
    for (let i = 0; i < req.preferences.length; i++) {
      const choiceCode = req.preferences[i];
      const cutoffs = cache.cutoffsByChoiceCode.get(choiceCode);
      if (!cutoffs || cutoffs.length === 0) continue;

      const branch = cache.branches.get(choiceCode);
      if (!branch) continue;
      const college = cache.colleges.get(branch.collegeCode);
      if (!college) continue;

      const collegeCtx: CollegeEligibilityContext = {
        homeUniversity: college.homeUniversity,
        minorityCommunity: minorityCommunity(college.status),
      };

      // Only pass cutoffs for this round — simulates that round's allotment
      const roundCutoffs = cutoffs.filter((r) => r.round === round);
      if (roundCutoffs.length === 0) continue;

      const result = rankFind(candidate, collegeCtx, roundCutoffs);
      if (!result.best || result.best.status === "out-of-range") continue;

      allotments.push({
        round,
        rank: i + 1,
        choiceCode,
        collegeName: college.name,
        branch: branch.name,
        seatType: result.best.seatType,
        closingMerit: result.best.closingMerit,
      });
      break; // Found allotment for this round — move to next round
    }
  }

  return c.json({ allotments, rounds: ROUNDS });
}
