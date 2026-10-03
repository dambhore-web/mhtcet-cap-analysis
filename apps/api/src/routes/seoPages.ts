import type { Context } from "hono";
import type { AppCache } from "../startup.ts";
import { openLatestRows } from "./branches.ts";

/**
 * GET /api/seo-pages — what the web build needs to write a ready-made HTML page per public URL
 * (apps/web/scripts/prerender.ts): each college with cutoffs, and each of its branches with the
 * open-seat Round I and latest-round closing (the same rule as open-latest) and the years of data.
 * Public data only, the same as the college pages show.
 */
export function getSeoPages(c: Context, cache: AppCache) {
  const byCollege = new Map<string, { choiceCode: string; name: string; roundI: number | null; latest: number; seatType: string; years: number[] }[]>();
  for (const [choiceCode, collegeCode, name, roundI, latest, , seatType] of openLatestRows(cache)) {
    const years = [...new Set([...(cache.history.get(choiceCode) ?? []).map((r) => r.year), cache.year])].sort();
    byCollege.set(collegeCode, [...(byCollege.get(collegeCode) ?? []), { choiceCode, name, roundI, latest, seatType, years }]);
  }
  const colleges = [...byCollege]
    .filter(([code]) => cache.colleges.has(code))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, branches]) => {
      const col = cache.colleges.get(code)!;
      return {
        code,
        name: col.name,
        district: col.district ?? null,
        collegeType: col.collegeType ?? null,
        branches: branches.sort((p, q) => (p.roundI ?? p.latest) - (q.roundI ?? q.latest)),
      };
    });
  return c.json({ year: cache.year, colleges });
}
