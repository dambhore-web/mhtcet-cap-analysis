import type { Context } from "hono";
import type { AppCache } from "../startup.ts";

/**
 * GET /api/sitemap — the public pages worth listing for search engines (SEO): every college that has
 * cutoffs in the cache year, with the choice codes of its branches that have cutoffs. The web build
 * turns this into sitemap.xml (apps/web/scripts/write-seo-files.mjs). Only codes, no data values.
 */
export function getSitemap(c: Context, cache: AppCache) {
  const byCollege = new Map<string, string[]>();
  for (const [choiceCode, rows] of cache.cutoffsByChoiceCode) {
    if (rows.length === 0) continue;
    const branch = cache.branches.get(choiceCode);
    if (!branch || !cache.colleges.has(branch.collegeCode)) continue;
    byCollege.set(branch.collegeCode, [...(byCollege.get(branch.collegeCode) ?? []), choiceCode]);
  }
  const colleges = [...byCollege]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, branches]) => ({ code, branches: branches.sort() }));
  return c.json({ year: cache.year, colleges });
}
