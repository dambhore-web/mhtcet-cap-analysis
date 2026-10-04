import type { Context } from "hono";
import type { FeeIndex } from "../feeIndex.ts";
import type { AppCache } from "../startup.ts";
import { slugify } from "@mhtcet/core";
import { openLatestRows } from "./branches.ts";
import { districtSummaries } from "./districts.ts";

/**
 * GET /api/sitemap — the public pages worth listing for search engines (SEO): every college that has
 * cutoffs in the cache year, with the choice codes of its branches that have cutoffs, and every
 * district landing page with its branch-group pages, and the statewide branch-group pages. The web build turns this into sitemap.xml
 * (apps/web/scripts/write-seo-files.mjs). Only codes and slugs, no data values.
 */
export function getSitemap(c: Context, cache: AppCache, fees: FeeIndex) {
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
  const districts = districtSummaries(cache, fees).map((d) => ({ slug: d.slug, groups: d.groups.map((g) => g.slug) }));
  // the statewide branch-group pages (/branches/computer-it), for groups with open-seat cutoffs
  const branchGroups = [...new Set(openLatestRows(cache).flatMap((r) => (r[5] ? [slugify(r[5])] : [])))].sort();
  return c.json({ year: cache.year, colleges, districts, branchGroups });
}
