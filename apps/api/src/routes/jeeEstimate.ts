import type { Context } from "hono";
import type pg from "pg";

// Fallback only: typical JEE Main candidate count, used when the All India merit list isn't loaded.
const JEE_TOTAL_CANDIDATES = 1350000;

/**
 * GET /api/jee-estimate?percentile=95.5&year=2026
 *
 * All India seats in Maharashtra CAP are allotted by the All India merit number, which ranks
 * JEE Main candidates by percentile (`merit_lookup`, list PCMAI, exam JEE). For a percentile p the
 * merit number lies between the last candidate above p and the first candidate below p.
 */
export async function getJeeEstimate(c: Context, pool: pg.Pool) {
  const percentileStr = c.req.query("percentile");
  const year = parseInt(c.req.query("year") ?? "2026", 10);
  if (!percentileStr) return c.json({ error: "percentile_required" }, 400);

  const percentile = parseFloat(percentileStr);
  if (isNaN(percentile) || percentile < 0 || percentile > 100) {
    return c.json({ error: "invalid_percentile" }, 400);
  }

  try {
    const res = await pool.query<{ total: string; above: string | null; below: string | null }>(
      `SELECT
         COUNT(*) AS total,
         MAX(merit) FILTER (WHERE score > $1) AS above,
         MIN(merit) FILTER (WHERE score < $1) AS below
       FROM merit_lookup
       WHERE authority = 'MH-CET-CELL' AND year = $2 AND list = 'PCMAI' AND exam = 'JEE'`,
      [percentile, year],
    );
    const row = res.rows[0];
    const total = row ? parseInt(row.total, 10) : 0;
    if (total > 0) {
      const lo = row.above ? parseInt(row.above, 10) + 1 : 1;
      const hi = row.below ? Math.max(lo, parseInt(row.below, 10) - 1) : total;
      return c.json({
        percentile,
        estimatedRank: Math.round((lo + hi) / 2),
        rankRange: [lo, hi] as [number, number],
        totalCandidates: total,
        year,
        kind: "all-india-merit" as const,
        method: "data" as const,
        disclaimer: `All India merit number from the ${year} All India merit list (${total.toLocaleString("en-IN")} JEE Main candidates). Candidates with the same percentile share a range.`,
      });
    }
  } catch {
    // merit_lookup not reachable: fall back below
  }

  const estimatedRank = Math.max(1, Math.round(JEE_TOTAL_CANDIDATES * (1 - percentile / 100)));
  const band = Math.max(100, Math.round(JEE_TOTAL_CANDIDATES * 0.002));
  return c.json({
    percentile,
    estimatedRank,
    rankRange: [Math.max(1, estimatedRank - band), estimatedRank + band] as [number, number],
    totalCandidates: JEE_TOTAL_CANDIDATES,
    year,
    kind: "jee-rank" as const,
    method: "statistical" as const,
    disclaimer:
      "The All India merit list isn't loaded, so this is only a rough JEE Main rank from a typical candidate count. " +
      "It is not your All India merit number, so Compass won't search seats with it.",
  });
}
