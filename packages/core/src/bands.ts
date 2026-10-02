import type { RankStatus } from "./rankFinder.ts";

/**
 * Likely / Target / Reach (#136): the rank finder's status in the terms students and parents use.
 * See docs/03-domain/result-bands.md. Never "safe": every band is about last year, not a promise.
 *
 *   likely  round-I       the merit number was within last year's Round I closing
 *   target  later-round   within the closing by a later round
 *   reach   out-of-range  at most REACH_MARGIN worse than the loosest closing last year
 *   out     out-of-range  further than that
 */
export type Band = "likely" | "target" | "reach" | "out";

/** How far past last year's loosest closing still counts as Reach: 10% worse (owner decision 2026-10-02). */
export const REACH_MARGIN = 0.1;

/**
 * The band for one option. `closingMerit` is the rank finder's closing for that status: for an
 * out-of-range option it is the loosest closing across rounds (the student's best chance).
 */
export function bandOf(status: RankStatus, merit: number, closingMerit: number): Band {
  if (status === "round-I") return "likely";
  if (status === "later-round") return "target";
  return merit <= closingMerit * (1 + REACH_MARGIN) ? "reach" : "out";
}

export const BAND_LABELS: Record<Band, string> = {
  likely: "Likely",
  target: "Target",
  reach: "Reach",
  out: "Out of reach",
};
