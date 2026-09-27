import type { Context } from "hono";
import type { AppCache } from "../startup.ts";
import { roundNumber, type Round } from "@mhtcet/core";

/** GET /api/colleges?q=&university=&limit=400 — search by name/code, filter by homeUniversity, sorted alphabetically. */
export function getColleges(c: Context, cache: AppCache) {
  const q = (c.req.query("q") ?? "").toLowerCase().trim();
  const university = (c.req.query("university") ?? "").trim();
  const limit = Math.min(parseInt(c.req.query("limit") ?? "400", 10) || 400, 400);

  const results: { code: string; name: string; status: string | null; homeUniversity: string | null }[] = [];
  for (const college of cache.colleges.values()) {
    if (q && !college.name.toLowerCase().includes(q) && !college.code.toLowerCase().includes(q)) continue;
    if (university && college.homeUniversity !== university) continue;
    results.push({
      code: college.code,
      name: college.name,
      status: college.status,
      homeUniversity: college.homeUniversity,
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name, "en"));
  const paged = results.slice(0, limit);

  return c.json({ colleges: paged, count: paged.length, total: results.length });
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
        round: roundNumber(r.round as Round),
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
