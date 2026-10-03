import { eligibleSeatTypes } from "@mhtcet/core";
import type { Category, DataMeta } from "./api";
import { formatNumber } from "./format";
import { formatPercentile } from "./percentile";

/** What the "checking the CAP lists" screen (#142) says. Each stage names work the search really does. */

export interface ScanRequest {
  merit: number;
  /** Set when the student searched by percentile (merit is then 0). */
  percentile?: number | null;
  candidature: "MH" | "AI";
  estimated: boolean;
  category: Category | "";
  gender: "M" | "F";
  homeUniversity: string;
  flags: { ews: boolean; tfws: boolean; defence: boolean; pwd: boolean; orphan: boolean };
  minority: string;
}

export interface ScanStage {
  title: string;
  detail: string;
}

/** The minimum time the screen stays up, unless the student prefers reduced motion. */
export const SCAN_MIN_MS = 3000;

/** Seat types this student can be matched against, for the second stage ("GOBCH, LOBCH … and 6 more"). */
export function seatTypesLine(r: ScanRequest, show = 5): string {
  if (r.candidature === "AI") return "All India (AI) seats";
  const codes = eligibleSeatTypes(
    {
      candidature: "MH",
      homeUniversity: r.homeUniversity || null,
      category: r.category || null,
      gender: r.gender,
      ...r.flags,
      ews: r.flags.ews && !r.category,
      minorityCommunity: r.minority || null,
      meritNumber: r.merit,
      subjectGroup: "PCM",
    },
    // a college in the student's own university (H seats) that is a minority college of their community
    { homeUniversity: r.homeUniversity || null, minorityCommunity: r.minority || null },
  ).filter((c) => r.gender === "F" || !c.startsWith("L"));
  const head = codes.slice(0, show).join(", ");
  return codes.length > show ? `${head} and ${codes.length - show} more` : head;
}

export function scanStages(meta: DataMeta | null, r: ScanRequest): ScanStage[] {
  const year = meta?.year ?? new Date().getFullYear();
  const merit = r.percentile
    ? `percentile ${formatPercentile(r.percentile)}`
    : `${r.estimated ? "estimated " : ""}${r.candidature === "AI" ? "All India " : ""}merit number ${formatNumber(r.merit)}`;
  const stages: ScanStage[] = [
    meta
      ? {
          title: `Loaded the ${year} CAP cutoffs:`,
          detail: `${formatNumber(meta.cutoffRows)} closing merit numbers across ${formatNumber(meta.colleges)} colleges`,
        }
      : { title: `Loaded the ${year} CAP cutoffs`, detail: "for every college and branch" },
    { title: "Matched the seats you can take:", detail: seatTypesLine(r) },
    { title: `Compared ${merit}`, detail: "with Rounds I to IV" },
  ];
  const earlier = meta?.earlierYears ?? [];
  if (earlier.length) {
    const sorted = [...earlier].sort();
    stages.push({ title: `Checked ${sorted[0]}–${sorted[sorted.length - 1]} trends`, detail: "for each of your options" });
  }
  stages.push({ title: "Sorted by your chances", detail: "Round I first" });
  return stages;
}

/**
 * How many stages show as done at `elapsedMs`: they tick evenly across the minimum time, and the
 * last one only completes once the search has returned.
 */
export function stagesDone(total: number, elapsedMs: number, searchDone: boolean, minMs = SCAN_MIN_MS): number {
  const byTime = minMs <= 0 ? total : Math.floor((elapsedMs / minMs) * total);
  const capped = Math.min(total - 1, byTime);
  return searchDone && elapsedMs >= minMs ? total : Math.max(0, capped);
}
