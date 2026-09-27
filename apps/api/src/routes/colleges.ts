import type { Context } from "hono";
import type { AppCache } from "../startup.ts";

/** GET /api/colleges?q=&limit=50 — case-insensitive search on name or code. */
export function getColleges(c: Context, cache: AppCache) {
  const q = (c.req.query("q") ?? "").toLowerCase().trim();
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10) || 50, 200);

  const results = [];
  for (const college of cache.colleges.values()) {
    if (!q || college.name.toLowerCase().includes(q) || college.code.includes(q)) {
      results.push({
        code: college.code,
        name: college.name,
        status: college.status,
        homeUniversity: college.homeUniversity,
      });
      if (results.length >= limit) break;
    }
  }

  return c.json({ colleges: results, count: results.length });
}

/** GET /api/colleges/:code/cutoffs?year= — all cutoff rows for one college (all branches, rounds, seat types). */
export function getCollegeCutoffs(c: Context, cache: AppCache) {
  const code = c.req.param("code") ?? "";
  const year = parseInt(c.req.query("year") ?? String(cache.year), 10);

  if (year !== cache.year) {
    return c.json({ error: "year_not_loaded", message: `Only year ${cache.year} is available` }, 404);
  }

  const college = cache.colleges.get(code);
  if (!college) return c.json({ error: "not_found" }, 404);

  const rows: object[] = [];
  for (const [choiceCode, cutoffs] of cache.cutoffsByChoiceCode) {
    const branch = cache.branches.get(choiceCode);
    if (!branch || branch.collegeCode !== code) continue;
    for (const r of cutoffs) {
      rows.push({
        choiceCode: r.choiceCode,
        branch: branch.name,
        list: r.list,
        round: r.round,
        section: r.section,
        seatType: r.seatType,
        stage: r.stage,
        closingMerit: r.closingMerit,
        closingPercentile: r.closingPercentile,
      });
    }
  }

  return c.json({ college: { code: college.code, name: college.name }, year, cutoffs: rows });
}
