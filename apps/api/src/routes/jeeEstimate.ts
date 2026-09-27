import type { Context } from "hono";

// JEE Main 2026 candidate counts (NTA provisional; updated when final data lands)
const JEE_TOTAL_CANDIDATES = 1350000; // ~13.5 lakh typical JEE Main candidates

/** GET /api/jee-estimate?percentile=95.5 */
export function getJeeEstimate(c: Context) {
  const percentileStr = c.req.query("percentile");
  if (!percentileStr) return c.json({ error: "percentile_required" }, 400);

  const percentile = parseFloat(percentileStr);
  if (isNaN(percentile) || percentile < 0 || percentile > 100) {
    return c.json({ error: "invalid_percentile" }, 400);
  }

  // NTA formula: rank ≈ total × (1 - percentile/100)
  const estimatedRank = Math.max(1, Math.round(JEE_TOTAL_CANDIDATES * (1 - percentile / 100)));
  const band = Math.max(100, Math.round(JEE_TOTAL_CANDIDATES * 0.002)); // ±0.2% band

  return c.json({
    percentile,
    estimatedRank,
    rankRange: [Math.max(1, estimatedRank - band), estimatedRank + band],
    totalCandidates: JEE_TOTAL_CANDIDATES,
    year: 2026,
    method: "statistical" as const,
    disclaimer:
      "Estimated JEE Main rank based on typical candidate count (~13.5 lakh). " +
      "Actual rank depends on NTA normalisation and final result. " +
      "For AI seats in MHT-CET CAP, enter this rank as your merit number and select AI candidature.",
  });
}
