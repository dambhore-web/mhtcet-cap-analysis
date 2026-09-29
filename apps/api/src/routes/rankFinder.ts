import type { Context } from "hono";
import { z } from "zod";
import { CATEGORIES } from "@mhtcet/core";
import type { AppCache } from "../startup.ts";
import { findOptions } from "../services/findOptions.ts";

const FlagsSchema = z.object({
  ews: z.boolean().default(false),
  tfws: z.boolean().default(false),
  defence: z.boolean().default(false),
  pwd: z.boolean().default(false),
  orphan: z.boolean().default(false),
}).default({});

const ResultFiltersSchema = z.object({
  university: z.string().nullable().default(null),
  district: z.string().nullable().default(null),
  collegeType: z.string().nullable().default(null),
  branchGroup: z.string().nullable().default(null),
  branchGroups: z.array(z.string().max(40)).max(10).default([]),
  branch: z.string().nullable().default(null),
}).default({});

const RequestSchema = z.object({
  year: z.number().int().min(2023).max(2030).default(2026),
  merit: z.number().int().min(1),
  /** MH = state merit number against state-quota seats; AI = All India merit number against AI seats (JEE Main). */
  candidature: z.enum(["MH", "AI"]).default("MH"),
  homeUniversity: z.string().nullable().default(null),
  category: z.enum(CATEGORIES).nullable().default(null),
  gender: z.enum(["M", "F"]),
  minorityCommunity: z.string().nullable().default(null),
  flags: FlagsSchema,
  subjectGroup: z.enum(["PCM", "PCB"]).default("PCM"),
  filters: ResultFiltersSchema,
});

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

  const options = findOptions(cache, req);
  return c.json({ options, count: options.length });
}
