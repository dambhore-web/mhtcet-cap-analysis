import { formatNumber } from "./format";

/**
 * How a student's merit number compares with a closing merit number (#140). A smaller merit number
 * is better, so the words are always "better" / "worse", never "above", "below", "to spare" or
 * "safe". The difference is a count of candidates, not seats.
 */
export interface MeritGap {
  kind: "better" | "worse" | "equal";
  /** Absolute difference in merit numbers (candidates). */
  diff: number;
  /** For tables and badges: "1,550 better", "3,950 worse", "same as closing". */
  short: string;
  /** A full sentence: "Your merit number 12,450 is 1,550 better than last year's closing (14,000)." */
  long: string;
}

export function describeMeritGap(merit: number, closing: number): MeritGap {
  const diff = Math.abs(closing - merit);
  if (merit === closing) {
    return {
      kind: "equal",
      diff: 0,
      short: "same as closing",
      long: `Your merit number ${formatNumber(merit)} is the same as last year's closing (${formatNumber(closing)}).`,
    };
  }
  const kind = merit < closing ? "better" : "worse";
  return {
    kind,
    diff,
    short: `${formatNumber(diff)} ${kind}`,
    long: `Your merit number ${formatNumber(merit)} is ${formatNumber(diff)} ${kind} than last year's closing (${formatNumber(closing)}).`,
  };
}
