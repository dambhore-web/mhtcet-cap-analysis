import type { Round } from "./rounds.ts";
import { autoFreezes, SIMULATED_ROUNDS } from "./capRules.ts";

/** Whether a preference had a seat for the candidate's merit in one round, and on what terms. */
export interface RoundSeat {
  seatType: string;
  closingMerit: number;
}

/** `seats[i][round]` is the seat available at preference i+1 in that round, or null. */
export type SeatAvailability = ReadonlyArray<Partial<Record<Round, RoundSeat | null>>>;

export interface SimulatedRound {
  round: Round;
  /** 1-based preference held after this round, or null if no seat yet. */
  preference: number | null;
  seatType: string | null;
  closingMerit: number | null;
  /** Moved to a higher preference in this round. */
  movedUp: boolean;
  /** The seat is frozen after this round (auto-freeze zone, or final round). */
  frozen: boolean;
  /** Frozen in an earlier round, so this round could not change anything. */
  frozenEarlier: boolean;
}

/**
 * Replays CAP rounds for one ordered option form.
 *
 * Model (stated to users as a rehearsal, not a prediction):
 * - Each round gives the highest preference that had a seat for this merit in that round.
 * - After an allotment the candidate floats (keeps the seat, stays in line for higher preferences)
 *   unless the auto-freeze rule locks the seat.
 * - A held seat is never lost to a lower preference.
 */
export function simulateCap(seats: SeatAvailability, rounds: readonly Round[] = SIMULATED_ROUNDS): SimulatedRound[] {
  const out: SimulatedRound[] = [];
  let held: number | null = null; // 0-based index of the preference held
  let heldSeat: RoundSeat | null = null;
  let frozen = false;

  for (const round of rounds) {
    if (frozen) {
      out.push({ ...out[out.length - 1], round, movedUp: false, frozenEarlier: true });
      continue;
    }
    // Only preferences above the held seat can improve it.
    const limit = held ?? seats.length;
    let found: number | null = null;
    for (let i = 0; i < limit; i++) {
      if (seats[i]?.[round]) {
        found = i;
        break;
      }
    }
    const movedUp = found !== null && held !== null;
    if (found !== null) {
      held = found;
      heldSeat = seats[found][round] ?? null;
    }
    if (held !== null && autoFreezes(round, held + 1)) frozen = true;
    out.push({
      round,
      preference: held !== null ? held + 1 : null,
      seatType: heldSeat?.seatType ?? null,
      closingMerit: heldSeat?.closingMerit ?? null,
      movedUp,
      frozen,
      frozenEarlier: false,
    });
  }
  return out;
}
