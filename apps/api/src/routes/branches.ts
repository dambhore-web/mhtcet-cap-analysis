import type { Context } from "hono";
import type { AppCache } from "../startup.ts";

/** GET /api/branches — sorted list of every unique branch name in the cache. */
export function getBranches(c: Context, cache: AppCache) {
  const names = [...new Set([...cache.branches.values()].map((b) => b.name))].sort(
    (a, b) => a.localeCompare(b),
  );
  return c.json({ branches: names });
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
