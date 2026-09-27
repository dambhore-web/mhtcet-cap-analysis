import type { Context } from "hono";
import type pg from "pg";

// Statistical approximation based on typical MHT-CET candidate counts.
// Replaced automatically once real merit-list data is loaded (issue #10).
const TYPICAL_COUNTS: Record<string, number> = {
  PCM: 140000,
  PCB: 90000,
};

/** GET /api/merit-estimate?percentile=88.5&subjectGroup=PCM&year=2026 */
export async function getMeritEstimate(c: Context, pool: pg.Pool) {
  const percentileStr = c.req.query("percentile");
  const subjectGroup = (c.req.query("subjectGroup") ?? "PCM").toUpperCase();
  const year = parseInt(c.req.query("year") ?? "2026", 10);

  if (!percentileStr) return c.json({ error: "percentile_required" }, 400);
  const percentile = parseFloat(percentileStr);
  if (isNaN(percentile) || percentile < 0 || percentile > 100) {
    return c.json({ error: "invalid_percentile" }, 400);
  }
  if (!["PCM", "PCB"].includes(subjectGroup)) {
    return c.json({ error: "invalid_subject_group" }, 400);
  }

  // Try real data first (populated by issue #10)
  const examCode = subjectGroup === "PCM" ? "MHT-CET-PCM" : "MHT-CET-PCB";
  try {
    const res = await pool.query<{ cnt: string; min_merit: string; max_merit: string }>(
      `SELECT
         COUNT(*) AS cnt,
         MIN(merit) FILTER (WHERE score >= $1 - 0.5 AND score < $1 + 0.5) AS min_merit,
         MAX(merit) FILTER (WHERE score >= $1 - 0.5 AND score < $1 + 0.5) AS max_merit
       FROM merit_lookup
       WHERE authority = 'MH-CET-CELL' AND year = $2 AND exam = $3`,
      [percentile, year, examCode]
    );
    const row = res.rows[0];
    const total = parseInt(row.cnt, 10);
    if (total > 0 && row.min_merit && row.max_merit) {
      return c.json({
        percentile,
        subjectGroup,
        year,
        estimatedMeritRange: [parseInt(row.min_merit, 10), parseInt(row.max_merit, 10)],
        sampleSize: total,
        method: "data" as const,
        disclaimer: "Based on 2026 official MHT-CET state merit list. Tie-breaking rules may affect your exact rank.",
      });
    }
  } catch {
    // merit_lookup may not have MHT-CET rows yet — fall through to statistical estimate
  }

  // Statistical fallback
  const total = TYPICAL_COUNTS[subjectGroup] ?? 140000;
  const estimatedMerit = Math.round(total * (1 - percentile / 100));
  const band = Math.round(total * 0.01); // ±1% band
  return c.json({
    percentile,
    subjectGroup,
    year,
    estimatedMeritRange: [Math.max(1, estimatedMerit - band), estimatedMerit + band],
    sampleSize: null,
    method: "statistical" as const,
    disclaimer:
      "Statistical estimate only — actual merit list not yet loaded. Based on typical MHT-CET candidate counts. Your real rank may differ.",
  });
}
