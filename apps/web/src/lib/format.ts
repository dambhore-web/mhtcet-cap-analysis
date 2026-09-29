const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"] as const;

/** Roman numeral for a CAP round number (1 → "I"). Accepts a number or an existing numeral. */
export function roundNumeral(round: number | string): string {
  if (typeof round === "string") {
    const n = Number(round);
    if (Number.isInteger(n)) return ROMAN[n] ?? round;
    return round.toUpperCase();
  }
  return ROMAN[round] ?? String(round);
}

/**
 * The single way the app writes a CAP round.
 *   long  → "Round II"
 *   short → "R II"
 */
export function formatRound(round: number | string, style: "long" | "short" = "long"): string {
  const r = roundNumeral(round);
  return style === "short" ? `R ${r}` : `Round ${r}`;
}

/** "Rounds I–III" for a contiguous range. */
export function formatRoundRange(from: number, to: number): string {
  return from === to ? formatRound(from) : `Rounds ${roundNumeral(from)}–${roundNumeral(to)}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

/** Stable, meaningless avatar tint derived from a college code (same college → same colour). */
const AVATAR_TINTS = ["#ece9ff", "#eff6ff", "#f0fdf4", "#fffbeb", "#fdecef", "#f1f5f9"] as const;
export function avatarTint(code: string): string {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export function collegeInitials(name: string, code: string): string {
  const initials = name
    .split(" ")
    .filter((w) => w.length > 2 && /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return initials || code.slice(-2);
}

/** 1-based index of a CAP round given as a number or a Roman numeral ("II" → 2). Unknown → 99. */
export function roundIndex(round: number | string): number {
  if (typeof round === "number") return round;
  const n = Number(round);
  if (Number.isInteger(n)) return n;
  const i = ROMAN.indexOf(round.toUpperCase() as (typeof ROMAN)[number]);
  return i > 0 ? i : 99;
}
