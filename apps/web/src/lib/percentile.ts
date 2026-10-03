/**
 * Merit number ↔ percentile, from the pairs printed on the cutoff lists (GET /api/percentile-scale).
 * Every cutoff row prints the last admitted candidate's merit number and percentile, so the pairs
 * describe one year's merit list. The Find page uses this to place a percentile on its merit
 * ladders and to label them in percentile; the closings it shows are the printed percentiles.
 */
export type ScalePoint = [merit: number, percentile: number];

/** Which figure a student searches with, and which one the results show. */
export type ScoreKind = "merit" | "percentile";

/** A percentile between 0 (exclusive) and 100, or null: "96.42", "96.42%", "99.9" */
export function parsePercentileText(raw: string): number | null {
  const n = Number(raw.replace(/[%\s,]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

/** Two decimals, as students quote it; three near the top, where many closings share 99.9x. */
export function formatPercentile(p: number): string {
  const d = p >= 99.5 ? 3 : 2;
  return (Math.floor(p * 10 ** d) / 10 ** d).toFixed(d);
}

function interpolate(x: number, x0: number, x1: number, y0: number, y1: number): number {
  return x1 === x0 ? y0 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

/** The percentile at a merit number (null when the scale is empty). */
export function meritToPercentile(points: readonly ScalePoint[], merit: number): number | null {
  if (!points.length) return null;
  if (merit <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (merit >= last[0]) return last[1];
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= merit) lo = mid;
    else hi = mid;
  }
  return interpolate(merit, points[lo][0], points[hi][0], points[lo][1], points[hi][1]);
}

/** The merit number at a percentile (null when the scale is empty). Percentile falls as merit rises. */
export function percentileToMerit(points: readonly ScalePoint[], percentile: number): number | null {
  if (!points.length) return null;
  if (percentile >= points[0][1]) return points[0][0];
  const last = points[points.length - 1];
  if (percentile <= last[1]) return last[0];
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][1] >= percentile) lo = mid;
    else hi = mid;
  }
  return Math.max(1, Math.round(interpolate(percentile, points[lo][1], points[hi][1], points[lo][0], points[hi][0])));
}

/**
 * How a percentile compares with a closing percentile. Higher is better; the words stay "better" /
 * "worse" like the merit gap (#140), never "safe" or "to spare".
 */
export function describePercentileGap(pct: number, closing: number): { kind: "better" | "worse" | "equal"; short: string; long: string } {
  const diff = Math.abs(pct - closing);
  if (diff < 0.0005) {
    return { kind: "equal", short: "same as closing", long: `Your percentile ${formatPercentile(pct)} is the same as last year's closing (${formatPercentile(closing)}).` };
  }
  const kind = pct > closing ? "better" : "worse";
  const d = diff < 0.01 ? diff.toFixed(3) : diff.toFixed(2);
  return {
    kind,
    short: `${d} ${kind}`,
    long: `Your percentile ${formatPercentile(pct)} is ${d} ${kind} than last year's closing (${formatPercentile(closing)}).`,
  };
}
