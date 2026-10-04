import type { Context } from "hono";
import { roundNumber, type CutoffRow, type Round } from "@mhtcet/core";
import { type AppCache, branchIntake, type HistoryRow } from "../startup.ts";
import { openLatestRows } from "./branches.ts";

/** One earlier year of a branch's open seat: Round I and last-round closing. */
export interface SeoPastYear {
  year: number;
  roundI: number | null;
  latest: number;
}

/** A seat type's Round I closing in the cache year (MH list). */
export interface SeoSeatClosing {
  seatType: string;
  roundI: number;
  percentile: number | null;
}

export interface SeoBranchOut {
  choiceCode: string;
  name: string;
  roundI: number | null;
  latest: number;
  /** The same rows' closing percentiles (null when not printed). */
  roundIPct: number | null;
  latestPct: number | null;
  seatType: string;
  years: number[];
  /** CAP seats (seat matrix), null when not loaded. */
  intake: number | null;
  /** Earlier years of the same open seat type, oldest first. */
  past: SeoPastYear[];
  /** Round I closing per category seat type at the open seat's level, plus EWS and TFWS. */
  seatTypes: SeoSeatClosing[];
  /** All India seats, Round I: closing All India merit number and its JEE percentile (if a JEE row). */
  allIndia: { roundI: number; percentile: number | null } | null;
}

/** Category seat types shown per branch, at the open seat's level (S, O or H), then the standalone ones. */
const CATEGORY_ORDER = ["GOPEN", "GOBC", "GSEBC", "GSC", "GST", "GVJ", "GNT1", "GNT2", "GNT3", "LOPEN"];
const STANDALONE = ["EWS", "TFWS"];

/** Tightest Round I row (lowest closing merit), else null. */
function tightestRoundI<T extends { round: string | number; closingMerit: number }>(rows: readonly T[]): T | null {
  let best: T | null = null;
  for (const r of rows) if (String(r.round) === "I" && (!best || r.closingMerit < best.closingMerit)) best = r;
  return best;
}

/** Last published round's loosest row. */
function lastRound<T extends { round: string | number; closingMerit: number }>(rows: readonly T[]): T | null {
  let best: T | null = null;
  for (const r of rows) {
    if (!best) best = r;
    else {
      const n = roundNumber(String(r.round) as Round);
      const b = roundNumber(String(best.round) as Round);
      if (n > b || (n === b && r.closingMerit > best.closingMerit)) best = r;
    }
  }
  return best;
}

export function pastYears(history: readonly HistoryRow[], seatType: string, year: number): SeoPastYear[] {
  const byYear = new Map<number, HistoryRow[]>();
  for (const r of history) if (r.seatType === seatType && r.year < year) byYear.set(r.year, [...(byYear.get(r.year) ?? []), r]);
  return [...byYear]
    .sort(([a], [b]) => a - b)
    .map(([y, rows]) => ({ year: y, roundI: tightestRoundI(rows)?.closingMerit ?? null, latest: lastRound(rows)!.closingMerit }));
}

export function seatClosings(rows: readonly CutoffRow[], openSeatType: string): SeoSeatClosing[] {
  const level = /[SOH]$/.test(openSeatType) ? openSeatType.slice(-1) : "S";
  const wanted = [...CATEGORY_ORDER.map((c) => c + level), ...STANDALONE];
  const out: SeoSeatClosing[] = [];
  for (const st of wanted) {
    const best = tightestRoundI(rows.filter((r) => r.list === "MH" && r.seatType === st));
    if (best) out.push({ seatType: st, roundI: best.closingMerit, percentile: best.closingPercentile ?? null });
  }
  return out;
}

export function allIndiaRoundI(rows: readonly CutoffRow[]): SeoBranchOut["allIndia"] {
  const best = tightestRoundI(rows.filter((r) => r.list === "AI"));
  if (!best) return null;
  return { roundI: best.closingMerit, percentile: /^JEE/i.test(best.exam) ? (best.closingPercentile ?? null) : null };
}

/**
 * GET /api/seo-pages — what the web build needs to write a ready-made HTML page per public URL
 * (apps/web/scripts/prerender.ts): each college with cutoffs, and each of its branches with the
 * open-seat Round I and latest-round closing (the same rule as open-latest), percentiles, intake,
 * earlier years, category seat types and All India seats. Public data only, the same as the college
 * pages show.
 */
export function getSeoPages(c: Context, cache: AppCache) {
  const byCollege = new Map<string, SeoBranchOut[]>();
  for (const [choiceCode, collegeCode, name, roundI, latest, , seatType] of openLatestRows(cache)) {
    const history = cache.history.get(choiceCode) ?? [];
    const rows = cache.cutoffsByChoiceCode.get(choiceCode) ?? [];
    const open = rows.filter((r) => r.list === "MH" && r.seatType === seatType);
    const years = [...new Set([...history.map((r) => r.year), cache.year])].sort();
    byCollege.set(collegeCode, [
      ...(byCollege.get(collegeCode) ?? []),
      {
        choiceCode,
        name,
        roundI,
        latest,
        roundIPct: tightestRoundI(open)?.closingPercentile ?? null,
        latestPct: lastRound(open)?.closingPercentile ?? null,
        seatType,
        years,
        intake: branchIntake(cache.seats.get(choiceCode)),
        past: pastYears(history, seatType, cache.year),
        seatTypes: seatClosings(rows, seatType),
        allIndia: allIndiaRoundI(rows),
      },
    ]);
  }
  const colleges = [...byCollege]
    .filter(([code]) => cache.colleges.has(code))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, branches]) => {
      const col = cache.colleges.get(code)!;
      const intakes = branches.map((b) => b.intake).filter((n): n is number => n != null);
      return {
        code,
        name: col.name,
        district: col.district ?? null,
        collegeType: col.collegeType ?? null,
        homeUniversity: col.homeUniversity ?? null,
        intake: intakes.length ? intakes.reduce((a, b) => a + b, 0) : null,
        branches: branches.sort((p, q) => (p.roundI ?? p.latest) - (q.roundI ?? q.latest)),
      };
    });
  return c.json({ year: cache.year, colleges });
}
