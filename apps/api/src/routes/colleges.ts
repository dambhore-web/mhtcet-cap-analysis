import type { Context } from "hono";
import type { AppCache } from "../startup.ts";

/** Colleges with cutoff rows in the cache year; the college table also keeps colleges seen only in earlier years. */
const activeCodes = new WeakMap<AppCache, Set<string>>();
function collegesInCacheYear(cache: AppCache): Set<string> {
  let codes = activeCodes.get(cache);
  if (!codes) {
    codes = new Set<string>();
    for (const rows of cache.cutoffsByChoiceCode.values()) for (const r of rows) codes.add(r.collegeCode);
    activeCodes.set(cache, codes);
  }
  return codes;
}

/**
 * GET /api/colleges?q=&university=&district=&type=&limit=400
 * Lists only colleges taking part in the cache year's CAP (earlier-year-only colleges are skipped).
 * Search by name, code or district; filter by home university, district and college type; sorted by name.
 */
export function getColleges(c: Context, cache: AppCache) {
  const q = (c.req.query("q") ?? "").toLowerCase().trim();
  const university = (c.req.query("university") ?? "").trim();
  const district = (c.req.query("district") ?? "").trim();
  const type = (c.req.query("type") ?? "").trim();
  const limit = Math.min(parseInt(c.req.query("limit") ?? "400", 10) || 400, 400);

  const results: {
    code: string;
    name: string;
    status: string | null;
    homeUniversity: string | null;
    district: string | null;
    collegeType: string | null;
  }[] = [];
  const districts = new Set<string>();
  const types = new Set<string>();
  const active = collegesInCacheYear(cache);
  for (const college of cache.colleges.values()) {
    if (!active.has(college.code)) continue;
    if (college.district) districts.add(college.district);
    if (college.collegeType) types.add(college.collegeType);
    const haystack = `${college.name} ${college.code} ${college.district ?? ""}`.toLowerCase();
    if (q && !haystack.includes(q)) continue;
    if (university && college.homeUniversity !== university) continue;
    if (district && college.district !== district) continue;
    if (type && college.collegeType !== type) continue;
    results.push({
      code: college.code,
      name: college.name,
      status: college.status,
      homeUniversity: college.homeUniversity,
      district: college.district ?? null,
      collegeType: college.collegeType ?? null,
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name, "en"));
  const paged = results.slice(0, limit);

  return c.json({
    colleges: paged,
    count: paged.length,
    total: results.length,
    // Filter values present in the data; empty until district/type are loaded (#115)
    districts: [...districts].sort(),
    collegeTypes: [...types].sort(),
  });
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
        source: r.sourceFile ?? null,
        sourcePage: r.sourcePage ?? null,
      });
    }
  }

  return c.json({
    college: {
      code: college.code,
      name: college.name,
      status: college.status,
      homeUniversity: college.homeUniversity,
      district: college.district ?? null,
      collegeType: college.collegeType ?? null,
      totalIntake: college.totalIntake,
    },
    year,
    cutoffs: rows,
  });
}
