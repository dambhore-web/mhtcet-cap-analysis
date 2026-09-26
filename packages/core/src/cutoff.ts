import type { AllotmentRow } from "./types.ts";
import type { Round } from "./rounds.ts";

/** Closing (highest) merit number per group of allotment rows. Pure; used for the cross-check. */
export interface ComputedCutoff {
  round: Round;
  choiceCode: string;
  section: string;
  seatType: string;
  closingMerit: number;
  openingMerit: number;
  seatsFilled: number;
}

export function computeCutoffs(rows: readonly AllotmentRow[]): ComputedCutoff[] {
  const groups = new Map<string, ComputedCutoff>();
  for (const r of rows) {
    if (r.merit === null || !r.seatType) continue;
    const key = [r.round, r.choiceCode, r.section, r.seatType].join("|");
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        round: r.round, choiceCode: r.choiceCode, section: r.section, seatType: r.seatType,
        closingMerit: r.merit, openingMerit: r.merit, seatsFilled: 1,
      });
    } else {
      g.closingMerit = Math.max(g.closingMerit, r.merit);
      g.openingMerit = Math.min(g.openingMerit, r.merit);
      g.seatsFilled++;
    }
  }
  return [...groups.values()];
}
