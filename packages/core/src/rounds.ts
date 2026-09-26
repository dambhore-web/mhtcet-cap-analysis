/** CAP round as printed on CET Cell documents (Roman numerals). */
export type Round = "I" | "II" | "III" | "IV" | "V" | "VI";

export const ROUNDS: readonly Round[] = ["I", "II", "III", "IV", "V", "VI"];

export function toRound(n: number): Round {
  const r = ROUNDS[n - 1];
  if (!r) throw new Error(`invalid round number ${n}`);
  return r;
}

export function roundNumber(r: Round): number {
  return ROUNDS.indexOf(r) + 1;
}

export function isRound(s: string): s is Round {
  return (ROUNDS as readonly string[]).includes(s);
}
