import type { Context } from "hono";
import type { AppCache } from "../startup.ts";

/**
 * How merit numbers and percentiles line up in the cache year, read from the cutoff lists
 * themselves: every row prints the last admitted candidate's merit number and percentile, which
 * come from the same merit list. Used to place a percentile on the merit ladders and to show a
 * merit number as a percentile (the Find page's two views). Not a prediction: a lookup of one
 * year's published pairs.
 */
export type ScalePoint = [merit: number, percentile: number];

const MAX_POINTS = 600;

const memo = new WeakMap<AppCache, Map<string, ScalePoint[]>>();

/** Points sorted by merit, percentile never rising, thinned to at most MAX_POINTS. */
export function percentileScale(cache: AppCache, list: "MH" | "AI"): ScalePoint[] {
  let byList = memo.get(cache);
  if (!byList) memo.set(cache, (byList = new Map()));
  const hit = byList.get(list);
  if (hit) return hit;

  // MH lists print state merit with the MHT-CET percentile; AI lists mix exams, so use JEE rows only
  const best = new Map<number, number>();
  for (const rows of cache.cutoffsByChoiceCode.values()) {
    for (const r of rows) {
      if (r.list !== list || r.closingPercentile == null || !(r.closingPercentile > 0)) continue;
      if (list === "AI" && !/^JEE/i.test(r.exam)) continue;
      const cur = best.get(r.closingMerit);
      if (cur === undefined || r.closingPercentile < cur) best.set(r.closingMerit, r.closingPercentile);
    }
  }
  const sorted = [...best].sort(([a], [b]) => a - b);
  // A worse merit number never has a higher percentile: drop the rare printing glitch that would
  const mono: ScalePoint[] = [];
  for (const [m, p] of sorted) if (!mono.length || p <= mono[mono.length - 1][1]) mono.push([m, p]);
  // Thinned on a log scale, like the ladders: as fine near merit 100 as near 100,000
  const out: ScalePoint[] = [];
  if (mono.length) {
    const gap = (Math.log(mono[mono.length - 1][0]) - Math.log(mono[0][0])) / MAX_POINTS;
    for (let i = 0; i < mono.length; i++) {
      const last = out[out.length - 1];
      if (!last || i === mono.length - 1 || Math.log(mono[i][0]) - Math.log(last[0]) >= gap) out.push(mono[i]);
    }
  }
  byList.set(list, out);
  return out;
}

/** GET /api/percentile-scale?list=MH|AI */
export function getPercentileScale(c: Context, cache: AppCache) {
  const list = c.req.query("list") === "AI" ? "AI" : "MH";
  return c.json({ year: cache.year, list, points: percentileScale(cache, list) });
}
