import type { Context } from "hono";
import { roundNumber } from "@mhtcet/core";
import type { AppCache } from "../startup.ts";
import { BRANCH_GROUP_PATTERNS } from "../services/findOptions.ts";

/** GET /api/branches — sorted list of every unique branch name in the cache. */
export function getBranches(c: Context, cache: AppCache) {
  const names = [...new Set([...cache.branches.values()].map((b) => b.name))].sort(
    (a, b) => a.localeCompare(b),
  );
  return c.json({ branches: names });
}

/**
 * GET /api/cutoffs/open-latest — every branch's general open closing rank (MH list) for Round I and
 * the latest round of the cache year. Drives the landing page's "all of CAP on one ruler".
 * Rows: [choiceCode, collegeCode, branch, roundI | null, latest, group | null, seatType], where group
 * is the rank finder's branch group (BRANCH_GROUP_PATTERNS) and seatType the open seat used
 * (OPEN_FALLBACK).
 */
/**
 * Most university-affiliated colleges have no state-level open seat (GOPENS): their open seats are
 * split into other-than-home-university (GOPENO, open to every MH student from outside that
 * university) and home-university (GOPENH). Women's colleges have only ladies open seats (LOPEN*),
 * which come last. Taken in this order, so those colleges aren't dropped.
 */
export const OPEN_FALLBACK = ["GOPENS", "GOPENO", "GOPENH", "LOPENS", "LOPENO", "LOPENH"] as const;

/** One branch's open-seat closing in the cache year: [choiceCode, collegeCode, branch, roundI, latest, group, seatType]. */
export type OpenLatestRow = [string, string, string, number | null, number, string | null, string];

/** Every branch's open-seat Round I and latest-round closing (OPEN_FALLBACK order); shared by open-latest and seo-pages. */
export function openLatestRows(cache: AppCache): OpenLatestRow[] {
  const groups = Object.entries(BRANCH_GROUP_PATTERNS);
  const rows: OpenLatestRow[] = [];
  for (const [choiceCode, cutoffs] of cache.cutoffsByChoiceCode) {
    let seatType = "";
    let open: typeof cutoffs = [];
    for (const st of OPEN_FALLBACK) {
      open = cutoffs.filter((r) => r.list === "MH" && r.seatType === st);
      if (open.length) {
        seatType = st;
        break;
      }
    }
    if (open.length === 0) continue;
    const sorted = [...open].sort((a, b) => roundNumber(a.round) - roundNumber(b.round));
    const branch = cache.branches.get(choiceCode);
    if (!branch) continue;
    const r1 = sorted.find((r) => r.round === "I")?.closingMerit ?? null;
    const group = groups.find(([, re]) => re.test(branch.name))?.[0] ?? null;
    rows.push([choiceCode, branch.collegeCode, branch.name, r1, sorted[sorted.length - 1].closingMerit, group, seatType]);
  }
  return rows;
}

export function getOpenLatest(c: Context, cache: AppCache) {
  return c.json({ year: cache.year, seatTypes: OPEN_FALLBACK, rows: openLatestRows(cache) });
}

/**
 * GET /api/branches/:choiceCode/history — state (MH) closing ranks for one branch across the loaded
 * years (earlier years from `cache.history`, the cache year from the live cutoffs), for trends.
 */
export function getBranchHistory(c: Context, cache: AppCache) {
  const choiceCode = c.req.param("choiceCode") ?? "";
  const branch = cache.branches.get(choiceCode);
  if (!branch) return c.json({ error: "not_found" }, 404);

  const rows = [
    ...(cache.history.get(choiceCode) ?? []),
    ...(cache.cutoffsByChoiceCode.get(choiceCode) ?? [])
      .filter((r) => r.list === "MH")
      .map((r) => ({
        year: r.year, round: String(r.round), seatType: r.seatType, section: r.section, stage: r.stage,
        closingMerit: r.closingMerit, closingPercentile: r.closingPercentile,
      })),
  ].sort((a, b) => a.year - b.year);

  return c.json({
    choiceCode,
    collegeCode: branch.collegeCode,
    collegeName: cache.colleges.get(branch.collegeCode)?.name ?? null,
    branch: branch.name,
    years: [...new Set(rows.map((r) => r.year))],
    rows,
  });
}
