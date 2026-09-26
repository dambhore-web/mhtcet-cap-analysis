import { parseSeatType, type SeatType } from "./seatType.ts";

/**
 * Admission authorities. Each authority has its own seat-type grammar (and, later, its own
 * eligibility rule set). Only Maharashtra's State CET Cell is implemented; other states are
 * added by registering a new authority here, not by branching inside shared logic.
 */
export const AUTHORITY_IDS = ["MH-CET-CELL"] as const;
export type AuthorityId = (typeof AUTHORITY_IDS)[number];

export interface AuthorityRules {
  id: AuthorityId;
  name: string;
  /** Default exam for this authority's state-level merit. */
  defaultExam: string;
  parseSeatType(code: string): SeatType | null;
}

export const AUTHORITIES: Record<AuthorityId, AuthorityRules> = {
  "MH-CET-CELL": {
    id: "MH-CET-CELL",
    name: "State Common Entrance Test Cell, Maharashtra",
    defaultExam: "MHT-CET",
    parseSeatType,
  },
};

export function authorityRules(id: AuthorityId): AuthorityRules {
  return AUTHORITIES[id];
}
