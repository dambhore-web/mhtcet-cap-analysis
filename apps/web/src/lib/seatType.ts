/**
 * Plain-language labels for CET Cell seat-type codes.
 * Grammar mirrors packages/core/src/seatType.ts:
 *
 *   <quota><category><level>   e.g. GOPENS, LOBCH, PWDROBCS, DEFRSEBCS
 *     quota    G general · L ladies · PWD disability · PWDR PWD common reserved
 *              DEF defence · DEFR defence common reserved
 *     category OPEN OBC SEBC SC ST VJ NT1 NT2 NT3
 *     level    H home university · O other than home university · S state level
 *   standalone TFWS, EWS, MI, ORPHANI, ORPHANN, AI
 */

const CATEGORIES = ["SEBC", "OPEN", "OBC", "NT1", "NT2", "NT3", "SC", "ST", "VJ"] as const;
const RESERVED_RE = new RegExp(`^(PWDR|PWD|DEFR|DEF|G|L)(${CATEGORIES.join("|")})([HOS])$`);

const QUOTA: Record<string, string> = {
  G: "General",
  L: "Ladies",
  PWD: "Disability (PWD)",
  PWDR: "Disability (PWD), common",
  DEF: "Defence",
  DEFR: "Defence, common",
};

const CATEGORY: Record<string, string> = {
  OPEN: "open",
  OBC: "OBC",
  SEBC: "SEBC",
  SC: "SC",
  ST: "ST",
  VJ: "VJ/DT",
  NT1: "NT-B",
  NT2: "NT-C",
  NT3: "NT-D",
};

const LEVEL: Record<string, string> = {
  S: "state level",
  H: "home university",
  O: "other than home university",
};

const STANDALONE: Record<string, string> = {
  TFWS: "Tuition fee waiver (TFWS)",
  EWS: "Economically weaker section (EWS)",
  MI: "Minority",
  ORPHANI: "Orphan",
  ORPHANN: "Orphan",
  AI: "All India",
};

/** e.g. "GOPENH" → "General open, home university"; "LOPENS" → "Ladies open, state level". */
export function seatTypeLabel(code: string): string {
  const c = code.trim().toUpperCase();
  if (STANDALONE[c]) return STANDALONE[c];
  const m = RESERVED_RE.exec(c);
  if (!m) return c;
  const [, quota, category, level] = m;
  return `${QUOTA[quota]} ${CATEGORY[category]}, ${LEVEL[level]}`;
}

/** Short chip label, e.g. "GOPENH" → "General open (HU)". */
export function seatTypeShortLabel(code: string): string {
  const c = code.trim().toUpperCase();
  if (c === "TFWS") return "TFWS (fee waiver)";
  if (STANDALONE[c]) return STANDALONE[c];
  const m = RESERVED_RE.exec(c);
  if (!m) return c;
  const [, quota, category, level] = m;
  const lvl = level === "S" ? "" : level === "H" ? " (HU)" : " (OHU)";
  return `${QUOTA[quota]} ${CATEGORY[category]}${lvl}`;
}

const QUOTA_ORDER = ["G", "L", "DEF", "DEFR", "PWD", "PWDR"];
const CATEGORY_ORDER = ["OPEN", "OBC", "SEBC", "SC", "ST", "VJ", "NT1", "NT2", "NT3"];
const LEVEL_ORDER = ["S", "H", "O"];
const STANDALONE_ORDER = ["EWS", "TFWS", "MI", "ORPHANI", "ORPHANN", "AI"];

/** Sort key: general before ladies, open before reserved categories, state before home university. */
export function seatTypeSortKey(code: string): number {
  const c = code.trim().toUpperCase();
  const s = STANDALONE_ORDER.indexOf(c);
  if (s !== -1) return 10_000 + s;
  const m = RESERVED_RE.exec(c);
  if (!m) return 99_999;
  const [, quota, category, level] = m;
  return QUOTA_ORDER.indexOf(quota) * 1000 + CATEGORY_ORDER.indexOf(category) * 10 + LEVEL_ORDER.indexOf(level);
}

/** Open (unreserved) seats for general or ladies candidates. */
export function isOpenSeat(code: string): boolean {
  return /^[GL]OPEN[HOS]$/.test(code.trim().toUpperCase());
}

/** Level suffix: "S" state, "H" home university, "O" other. null for standalone codes (TFWS, EWS…). */
export function seatLevelCode(code: string): "S" | "H" | "O" | null {
  const c = code.trim().toUpperCase();
  if (STANDALONE[c]) return null;
  const m = RESERVED_RE.exec(c);
  return m ? (m[3] as "S" | "H" | "O") : null;
}

/** Category label without the level, e.g. "GOPENS" → "General open", "GSCH" → "General SC". */
export function seatCategoryLabel(code: string): string {
  const c = code.trim().toUpperCase();
  if (STANDALONE[c]) return STANDALONE[c];
  const m = RESERVED_RE.exec(c);
  if (!m) return c;
  return `${QUOTA[m[1]]} ${CATEGORY[m[2]]}`;
}

export const LEVEL_LABELS: Record<string, string> = {
  S: "State",
  H: "Home university",
  O: "Other than HU",
};
