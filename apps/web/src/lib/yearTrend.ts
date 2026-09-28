import { roundIndex } from "./format";

/** One state (MH) closing rank from /api/branches/:choiceCode/history. */
export interface HistoryRow {
  year: number;
  round: string;
  seatType: string;
  section: string;
  stage: string;
  closingMerit: number;
  closingPercentile: number | null;
}

/** "first": Round I of each year. "last": the last round each year ran (2023–2024 had three). */
export type RoundMode = "first" | "last";

export interface YearPoint {
  year: number;
  round: string;
  closingMerit: number;
}

/**
 * The closing rank of one seat type per year, for Round I or each year's last round. When a round
 * printed several rows for the seat type (stages), the first printed row is used, as on the rest of
 * the page. Years without that seat type are left out.
 */
export function yearSeries(rows: HistoryRow[], seatType: string, mode: RoundMode): YearPoint[] {
  const byYear = new Map<number, HistoryRow[]>();
  for (const r of rows) {
    if (r.seatType !== seatType) continue;
    byYear.set(r.year, [...(byYear.get(r.year) ?? []), r]);
  }
  const out: YearPoint[] = [];
  for (const [year, rs] of [...byYear].sort(([a], [b]) => a - b)) {
    const rounds = [...new Set(rs.map((r) => r.round))].sort((a, b) => roundIndex(a) - roundIndex(b));
    const round = mode === "first" ? rounds.find((r) => roundIndex(r) === 1) : rounds[rounds.length - 1];
    if (!round) continue;
    const row = rs.find((r) => r.round === round);
    if (row) out.push({ year, round, closingMerit: row.closingMerit });
  }
  return out;
}

export type TrendDirection = "harder" | "easier" | "steady";

export interface TrendVerdict {
  direction: TrendDirection;
  /** Change in closing rank from the first to the last year, as a fraction of the first (negative = harder). */
  change: number;
  from: YearPoint;
  to: YearPoint;
}

/** Changes within ±5% of the first year's closing rank count as steady. */
export const STEADY_BAND = 0.05;

/**
 * Harder / easier / steady between the first and last year shown. A lower closing rank means fewer
 * students got in, so the branch got harder. Needs at least two years.
 */
export function trendVerdict(points: YearPoint[]): TrendVerdict | null {
  if (points.length < 2) return null;
  const from = points[0];
  const to = points[points.length - 1];
  const change = (to.closingMerit - from.closingMerit) / from.closingMerit;
  const direction: TrendDirection = Math.abs(change) <= STEADY_BAND ? "steady" : change < 0 ? "harder" : "easier";
  return { direction, change, from, to };
}

/** Years in which a merit number was within the closing rank (merit ≤ closing rank). */
export function yearsWithin(points: YearPoint[], merit: number): number[] {
  return points.filter((p) => merit <= p.closingMerit).map((p) => p.year);
}

/** One earlier year of a rank-finder option (see PastYear in api.ts). */
export interface PastYearClosing {
  year: number;
  lastRoundClosing: number;
}

export interface PastSummary {
  years: number;
  /** Years in which the merit was within the last-round closing rank. */
  within: number;
  lo: number;
  hi: number;
  first: number;
  last: number;
}

/**
 * How a merit number fared against the same seat in earlier years, by last-round closing rank
 * (the same basis as "ranks to spare"). Null when there are no earlier years.
 */
export function pastSummary(past: PastYearClosing[], merit: number): PastSummary | null {
  if (!past.length) return null;
  const ranks = past.map((p) => p.lastRoundClosing);
  return {
    years: past.length,
    within: ranks.filter((r) => merit <= r).length,
    lo: Math.min(...ranks),
    hi: Math.max(...ranks),
    first: past[0].year,
    last: past[past.length - 1].year,
  };
}
