import type { Round } from "./rounds.ts";

/**
 * Auto-freeze rule of the Maharashtra FE CAP, as published in the 2025-26 information brochure:
 * if a candidate is allotted one of their top N options in a round, the seat is frozen
 * automatically and they are not considered for higher options in later rounds.
 *
 * Round I: option 1 · Round II: options 1–3 · Round III: options 1–6.
 * Round IV (and later) allotments are final.
 *
 * `ASSUMPTION`: re-check against each year's brochure before the option form opens.
 */
export const AUTO_FREEZE_TOP_N: Partial<Record<Round, number>> = { I: 1, II: 3, III: 6 };

/** Rounds replayed by the simulator. */
export const SIMULATED_ROUNDS: readonly Round[] = ["I", "II", "III", "IV"];

/** True if allotment to option `preference` (1-based) in `round` freezes the seat. */
export function autoFreezes(round: Round, preference: number): boolean {
  if (round === "IV" || round === "V" || round === "VI") return true;
  const n = AUTO_FREEZE_TOP_N[round];
  return n !== undefined && preference <= n;
}

/** The earliest round whose freeze zone includes `preference` (1-based), or null if none does. */
export function firstFreezeRound(preference: number): Round | null {
  for (const r of ["I", "II", "III"] as const) {
    if (preference <= (AUTO_FREEZE_TOP_N[r] ?? 0)) return r;
  }
  return null;
}
