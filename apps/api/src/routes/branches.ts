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
 * GET /api/cutoffs/open-latest — every branch's general open, state-level closing rank (GOPENS,
 * MH list) for Round I and the latest round of the cache year. Drives the landing page's
 * "all of CAP on one ruler". Rows: [choiceCode, collegeCode, branch, roundI | null, latest, group | null],
 * where group is the rank finder's branch group (BRANCH_GROUP_PATTERNS), so the web app doesn't
 * keep its own copy of the patterns.
 */
export function getOpenLatest(c: Context, cache: AppCache) {
  const groups = Object.entries(BRANCH_GROUP_PATTERNS);
  const rows: [string, string, string, number | null, number, string | null][] = [];
  for (const [choiceCode, cutoffs] of cache.cutoffsByChoiceCode) {
    const open = cutoffs.filter((r) => r.list === "MH" && r.seatType === "GOPENS");
    if (open.length === 0) continue;
    const sorted = [...open].sort((a, b) => roundNumber(a.round) - roundNumber(b.round));
    const branch = cache.branches.get(choiceCode);
    if (!branch) continue;
    const r1 = sorted.find((r) => r.round === "I")?.closingMerit ?? null;
    const group = groups.find(([, re]) => re.test(branch.name))?.[0] ?? null;
    rows.push([choiceCode, branch.collegeCode, branch.name, r1, sorted[sorted.length - 1].closingMerit, group]);
  }
  return c.json({ year: cache.year, seatType: "GOPENS", rows });
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
