import type { Context } from "hono";
import { z } from "zod";
import { CATEGORIES, rankFind, type CandidateProfile, type CollegeEligibilityContext } from "@mhtcet/core";
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
  homeUniversity: z.string().nullable().default(null),
  category: z.enum(CATEGORIES).nullable().default(null),
  gender: z.enum(["M", "F"]),
  minorityCommunity: z.string().nullable().default(null),
  flags: FlagsSchema,
  subjectGroup: z.enum(["PCM", "PCB"]).default("PCM"),
});

const STATUS_ORDER = { "round-I": 0, "later-round": 1, "out-of-range": 2 } as const;

/** POST /api/rank-finder */
export async function postRankFinder(c: Context, cache: AppCache) {
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

  const options: object[] = [];

  for (const [choiceCode, cutoffs] of cache.cutoffsByChoiceCode) {
    const branch = cache.branches.get(choiceCode);
    if (!branch) continue;
    const college = cache.colleges.get(branch.collegeCode);
    if (!college) continue;

    const collegeCtx: CollegeEligibilityContext = {
      homeUniversity: college.homeUniversity,
      minorityCommunity: minorityCommunity(college.status),
    };

    const result = rankFind(candidate, collegeCtx, cutoffs);
    if (!result.best) continue;

    options.push({
      collegeCode: branch.collegeCode,
      collegeName: college.name,
      choiceCode,
      branch: branch.name,
      seatType: result.best.seatType,
      status: result.best.status,
      round: result.best.round,
      closingMerit: result.best.closingMerit,
      year: req.year,
    });
  }

  options.sort((a, b) => {
    const ao = a as { status: keyof typeof STATUS_ORDER; closingMerit: number };
    const bo = b as { status: keyof typeof STATUS_ORDER; closingMerit: number };
    const sd = STATUS_ORDER[ao.status] - STATUS_ORDER[bo.status];
    if (sd !== 0) return sd;
    return bo.closingMerit - ao.closingMerit;
  });

  return c.json({ options, count: options.length });
}
