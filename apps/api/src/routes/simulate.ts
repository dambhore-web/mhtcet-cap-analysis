import type { Context } from "hono";
import { z } from "zod";
import {
  CATEGORIES,
  rankFind,
  simulateCap,
  SIMULATED_ROUNDS,
  AUTO_FREEZE_TOP_N,
  type CandidateProfile,
  type CollegeEligibilityContext,
  type Round,
  type RoundSeat,
} from "@mhtcet/core";
import { type AppCache, minorityCommunity } from "../startup.ts";

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
  candidature: z.enum(["MH", "AI"]).default("MH"),
  homeUniversity: z.string().nullable().default(null),
  category: z.enum(CATEGORIES).nullable().default(null),
  gender: z.enum(["M", "F"]),
  minorityCommunity: z.string().nullable().default(null),
  flags: FlagsSchema,
  subjectGroup: z.enum(["PCM", "PCB"]).default("PCM"),
  /** Ordered preference list — first choice first. Max 300. */
  preferences: z.array(z.string().min(1)).min(1).max(300),
});

export interface SimulatedAllotment {
  round: Round;
  rank: number;
  choiceCode: string;
  collegeName: string;
  branch: string;
  seatType: string;
  closingMerit: number;
}

export const SIMULATION_ASSUMPTIONS =
  "A replay of last year's closing ranks. Each round gives your highest choice that had a seat for your merit; " +
  "after a seat you float (keep it and stay in line for higher choices) unless the auto-freeze rule locks it. " +
  "This year's cutoffs and vacancies will differ, so treat it as a rehearsal, not a prediction.";

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

  // seats[i][round]: the best eligible seat at preference i+1 that admitted this merit in that round
  const seats: Partial<Record<Round, RoundSeat | null>>[] = [];
  const choices: { choiceCode: string; collegeCode: string | null; collegeName: string | null; branch: string | null; known: boolean }[] = [];

  for (const choiceCode of req.preferences) {
    const cutoffs = cache.cutoffsByChoiceCode.get(choiceCode) ?? [];
    const branch = cache.branches.get(choiceCode);
    const college = branch ? cache.colleges.get(branch.collegeCode) : undefined;
    choices.push({ choiceCode, collegeCode: branch?.collegeCode ?? null, collegeName: college?.name ?? null, branch: branch?.name ?? null, known: !!college });
    const byRound: Partial<Record<Round, RoundSeat | null>> = {};
    if (college) {
      const collegeCtx: CollegeEligibilityContext = {
        homeUniversity: college.homeUniversity,
        minorityCommunity: minorityCommunity(college.status),
      };
      for (const round of SIMULATED_ROUNDS) {
        const roundCutoffs = cutoffs.filter((r) => r.round === round);
        const best = roundCutoffs.length ? rankFind(candidate, collegeCtx, roundCutoffs).best : null;
        byRound[round] = best && best.status !== "out-of-range" ? { seatType: best.seatType, closingMerit: best.closingMerit } : null;
      }
    }
    seats.push(byRound);
  }

  const rounds = simulateCap(seats).map((r) => ({
    ...r,
    choice: r.preference ? choices[r.preference - 1] : null,
  }));

  // Legacy shape kept for older clients: one entry per round that held a seat
  const allotments: SimulatedAllotment[] = rounds
    .filter((r) => r.preference && r.choice?.known)
    .map((r) => ({
      round: r.round,
      rank: r.preference!,
      choiceCode: r.choice!.choiceCode,
      collegeName: r.choice!.collegeName!,
      branch: r.choice!.branch!,
      seatType: r.seatType!,
      closingMerit: r.closingMerit!,
    }));

  return c.json({
    rounds,
    grid: choices.map((ch, i) => ({ preference: i + 1, ...ch, byRound: seats[i] })),
    freezeZones: AUTO_FREEZE_TOP_N,
    assumptions: SIMULATION_ASSUMPTIONS,
    allotments,
  });
}
