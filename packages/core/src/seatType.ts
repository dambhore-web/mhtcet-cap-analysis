/**
 * Seat-type code grammar used by the CET Cell (legend printed on allotment and cutoff lists):
 *
 *   <quota><category><level>   e.g. GOPENS, LOBCH, PWDROBCS, DEFRSEBCS
 *     quota    G general · L ladies · PWD disability · PWDR PWD common reserved
 *              DEF defence · DEFR defence common reserved
 *     category OPEN OBC SEBC SC ST VJ NT1 NT2 NT3
 *     level    H home university · O other than home university · S state level
 *
 *   standalone codes: TFWS, EWS, MI (minority), ORPHANI, ORPHANN, AI (All India)
 */

export const CATEGORIES = ["OPEN", "OBC", "SEBC", "SC", "ST", "VJ", "NT1", "NT2", "NT3"] as const;
export type Category = (typeof CATEGORIES)[number];

export const QUOTAS = ["G", "L", "PWD", "PWDR", "DEF", "DEFR"] as const;
export type Quota = (typeof QUOTAS)[number];

export const LEVELS = { H: "home-university", O: "other-than-home-university", S: "state-level" } as const;
export type LevelCode = keyof typeof LEVELS;

export const STANDALONE = ["TFWS", "EWS", "MI", "ORPHANI", "ORPHANN", "AI"] as const;
export type StandaloneCode = (typeof STANDALONE)[number];

export type SeatType =
  | { code: string; kind: "reserved"; quota: Quota; category: Category; level: LevelCode; ladies: boolean }
  | { code: string; kind: "standalone"; standalone: StandaloneCode };

const RESERVED_RE = new RegExp(
  `^(PWDR|PWD|DEFR|DEF|G|L)(${[...CATEGORIES].sort((a, b) => b.length - a.length).join("|")})([HOS])$`,
);

/** Parse a seat-type code. Returns null when the code does not fit the grammar. */
export function parseSeatType(code: string): SeatType | null {
  const c = code.trim();
  if ((STANDALONE as readonly string[]).includes(c)) {
    return { code: c, kind: "standalone", standalone: c as StandaloneCode };
  }
  const m = RESERVED_RE.exec(c);
  if (!m) return null;
  const quota = m[1] as Quota;
  return { code: c, kind: "reserved", quota, category: m[2] as Category, level: m[3] as LevelCode, ladies: quota === "L" };
}

export function isSeatType(code: string): boolean {
  return parseSeatType(code) !== null;
}
