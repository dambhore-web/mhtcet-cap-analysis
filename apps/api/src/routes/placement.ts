import type { Context } from "hono";
import type { AppCache } from "../startup.ts";

/**
 * GET /api/colleges/:code/placement
 *
 * Placement of UG 4-year (B.E./B.Tech) graduates, one entry per graduating batch, oldest first,
 * from the data the college submitted to NIRF, plus the figures the college publishes on its own
 * website (collegeClaims). Rates are worked out here so every client shows the same numbers.
 */
export function getCollegePlacement(c: Context, cache: AppCache) {
  const code = c.req.param("code") ?? "";
  const rows = cache.placement?.get(code) ?? [];
  const site = cache.placementClaims?.get(code) ?? null;
  if (!rows.length && !site) return c.json({ available: false, code }, 200);
  const pct = (n: number | null, d: number) => (n === null || d <= 0 ? null : Math.round((n / d) * 1000) / 10);
  return c.json({
    available: true,
    code,
    // The college's own latest figures from its website: highest, average, median, placement %.
    collegeClaims: site
      ? {
          ...site,
          sources: [...new Set(site.claims.map((x) => x.sourceUrl))],
          disclaimer: "As published on the college's website; not checked independently.",
        }
      : null,
    program: "UG 4-year (B.E./B.Tech)",
    batches: rows.map((r) => ({
      graduationYear: r.graduationYear,
      graduates: r.graduates,
      placed: r.placed,
      placedPct: pct(r.placed, r.graduates),
      medianSalary: r.medianSalary,
      higherStudies: r.higherStudies,
      higherStudiesPct: pct(r.higherStudies, r.graduates),
      nirfYear: r.nirfYear,
      nirfCategory: r.nirfCategory,
      sourceUrl: r.sourceUrl,
    })),
    disclaimer:
      "Reported by the college to NIRF (National Institutional Ranking Framework). All B.E./B.Tech branches together; not checked independently.",
  });
}
