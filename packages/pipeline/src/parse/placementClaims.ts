/**
 * Placement figures that colleges publish on their own websites (issue #132): highest, average
 * and median package and placement percentage, read from the text of a placement page or PDF.
 *
 * These are the college's own claims, in whatever words it chose. Every claim keeps the sentence
 * it came from and the page URL, so it can be checked, and a year when one is written near it.
 */

export type ClaimMetric = "highest" | "average" | "median" | "placedPct";

export interface PlacementClaim {
  metric: ClaimMetric;
  /** Rupees per year for packages; percent for placedPct. */
  value: number;
  /** Academic or calendar year written next to the figure ("2024-25", "2025"), or null. */
  year: string | null;
  /** The line the figure was read from, trimmed to 200 characters. */
  snippet: string;
  sourceUrl: string;
}

const LABELS: Array<[Exclude<ClaimMetric, "placedPct">, RegExp]> = [
  ["highest", /\b(highest|maximum|max\.?|top|best)\s+(salary\s+)?(package|salary|ctc|pay\s*package|offer|compensation)\b/i],
  ["average", /\b(average|avg\.?|mean)\s+(salary\s+)?(package|salary|ctc|pay\s*package|compensation)\b/i],
  ["median", /\bmedian\s+(salary\s+)?(package|salary|ctc|pay\s*package|compensation)?\b/i],
];

/** An amount in lakhs ("12 LPA", "₹4.5 Lakh", "3.6 lacs"), crores ("1.2 Cr") or rupees ("₹ 6,00,000"). */
const AMOUNT =
  /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(lpa|l\.p\.a\.?|lakhs?|lacs?|lac|lakh)\b|(?:₹|rs\.?|inr)?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(crores?|cr)\b|(?:₹|rs\.?|inr)\s*(\d{1,2},\d{2},\d{3}|\d{5,8})\b/gi;

const PCT_AFTER = /\b(\d{2,3}(?:\.\d+)?)\s*%\s*(?:of\s+(?:the\s+)?(?:eligible\s+)?students\s+)?(?:placements?|placed|students\s+placed|placement\s+record)\b(?!\s*(?:assistance|support|readiness|guidance|training|help|oriented|opportunit|guarantee|cell|drive))/i;
/** Aims and promises ("to achieve 100% placement"), not results. */
const ASPIRATION = /\b(aim|aims|target|achieve|strive|ensure|goal|mission|vision|committed|commitment|to impart|we provide|assistance|support)\b/i;
const PCT_BEFORE = /\bplacements?\s*(?:record|rate|percentage|ratio|%)?\s*(?:of|:|-|is|–)?\s*(\d{2,3}(?:\.\d+)?)\s*%/i;
/** Figures for postgraduate, diploma or doctoral programs, which are not B.E./B.Tech placements. */
const NOT_UG = /\bm\.?\s?tech\b|\bmba\b|\bmca\b|\bph\.?\s?d\b|\bdiploma\b|\bpolytechnic\b|\bpost\s*graduate\b|\bpgdm\b/i;
const YEAR = /\b(20\d\d)\s*[-–/]\s*(20)?(\d\d)\b|\b(20\d\d)\b/g;

function toRupees(m: RegExpExecArray): number | null {
  if (m[1]) return Math.round(Number(m[1].replace(",", ".")) * 100_000);
  if (m[3]) return Math.round(Number(m[3]) * 10_000_000);
  if (m[5]) return Number(m[5].replace(/,/g, ""));
  return null;
}

/** Latest year written in `text` (2015–2030), as "2024-25" or "2025". */
export function latestYear(text: string): string | null {
  let best: { key: number; label: string } | null = null;
  for (const m of text.matchAll(YEAR)) {
    const start = Number(m[1] ?? m[4]);
    if (start < 2015 || start > 2030) continue;
    const label = m[1] ? `${m[1]}-${m[3]}` : m[4];
    const key = m[1] ? start + 1 : start;
    if (!best || key > best.key) best = { key, label };
  }
  return best?.label ?? null;
}

/** Packages outside these bounds are not yearly salaries (stipends, fees, company revenue…). */
const BOUNDS: Record<Exclude<ClaimMetric, "placedPct">, [number, number]> = {
  highest: [150_000, 20_000_000],
  average: [100_000, 5_000_000],
  median: [100_000, 5_000_000],
};

/**
 * Claims in one page's text. A label and its amount are read from the same line, or from two
 * neighbouring lines (counter widgets print "12 LPA" and "Highest Package" on separate lines).
 * The year is the latest one on that line, or on the nearest line above it that has one, or in
 * the page heading. Lines about postgraduate, diploma or doctoral programs are skipped. Pure.
 */
export function extractClaims(text: string, sourceUrl: string): PlacementClaim[] {
  const lines = text.split(/\r?\n|\s\|\s/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out: PlacementClaim[] = [];
  // A page whose heading is about a postgraduate or diploma program is skipped as a whole.
  if (NOT_UG.test(lines.slice(0, 5).join(" ")) && !/\bb\.?\s?(tech|e)\b|\bug\b/i.test(lines.slice(0, 5).join(" "))) return out;
  const pageYear = latestYear(lines.slice(0, 15).join(" "));
  const seen = new Set<string>();
  const push = (c: PlacementClaim) => {
    const key = `${c.metric}|${c.value}|${c.year}`;
    if (!seen.has(key)) { seen.add(key); out.push(c); }
  };
  // The year of a figure: on its own line, else the nearest line above it (up to six lines up).
  const yearAt = (i: number): string | null => {
    for (let j = i; j >= Math.max(0, i - 6); j--) {
      const y = latestYear(lines[j]);
      if (y) return y;
    }
    return pageYear;
  };
  const labelOf = (l: string | undefined) => (l && l.length < 40 ? LABELS.find(([, re]) => re.test(l))?.[0] ?? null : null);
  lines.forEach((line, i) => {
    if (NOT_UG.test(line)) return;
    const year = yearAt(i);
    const snippet = line.slice(0, 200);

    for (const [metric, label] of LABELS) {
      // Same line: the first amount after the label, else the nearest one before it.
      const lm = label.exec(line);
      let amount: number | null = null;
      if (lm) {
        const after = line.slice(lm.index);
        const re = new RegExp(AMOUNT.source, "gi");
        const a = re.exec(after);
        if (a && a.index < 60) amount = toRupees(a);
        else {
          const before = [...line.slice(0, lm.index).matchAll(new RegExp(AMOUNT.source, "gi"))].pop();
          if (before && lm.index - (before.index ?? 0) < 40) amount = toRupees(before);
        }
      } else if (/^\s*(?:₹|rs\.?|inr)?\s*[\d.,]+\s*(?:\+\s*)?(lpa|lakhs?|lacs?|lac|lakh|crores?|cr)\b[^a-z]*$/i.test(line)) {
        // A bare amount line: its label is on the next short line, or else on the previous one.
        const neighbour = labelOf(lines[i + 1]) ?? labelOf(lines[i - 1]);
        if (neighbour === metric) {
          const a = new RegExp(AMOUNT.source, "gi").exec(line);
          if (a) amount = toRupees(a);
        }
      }
      if (amount === null) continue;
      const [lo, hi] = BOUNDS[metric];
      if (amount < lo || amount > hi) continue;
      push({ metric, value: amount, year, snippet, sourceUrl });
    }

    const p = ASPIRATION.test(line) ? null : PCT_AFTER.exec(line) ?? PCT_BEFORE.exec(line);
    if (p) {
      const v = Number(p[1]);
      if (v >= 10 && v <= 100) push({ metric: "placedPct", value: v, year, snippet, sourceUrl });
    }
  });
  return out;
}

export interface ClaimSummary {
  year: string | null;
  highest: number | null;
  average: number | null;
  median: number | null;
  placedPct: number | null;
  /** The claims the summary was built from. */
  claims: PlacementClaim[];
}

/** Sort key of a year label: "2024-25" → 2025, "2025" → 2025, null → 0. */
function yearKey(y: string | null): number {
  if (!y) return 0;
  const m = y.match(/^(20\d\d)(?:-(\d\d))?$/);
  return m ? (m[2] ? Number(m[1]) + 1 : Number(m[1])) : 0;
}

/**
 * A college's latest figures: the most recent year that has any claim (undated claims only when no
 * claim is dated). Highest is the largest highest claim of that year; average, median and
 * placement % are the most often repeated value (the first one found on a tie). An average or
 * median above the highest package is dropped as inconsistent. Pure.
 */
export function summariseClaims(claims: PlacementClaim[]): ClaimSummary | null {
  if (!claims.length) return null;
  const latest = Math.max(...claims.map((c) => yearKey(c.year)));
  const pick = claims.filter((c) => yearKey(c.year) === latest);
  const mode = (metric: ClaimMetric): number | null => {
    const vals = pick.filter((c) => c.metric === metric).map((c) => c.value);
    if (!vals.length) return null;
    const counts = new Map<number, number>();
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0][0];
  };
  const highs = pick.filter((c) => c.metric === "highest").map((c) => c.value);
  const highest = highs.length ? Math.max(...highs) : null;
  let average = mode("average");
  let median = mode("median");
  if (highest !== null && average !== null && average > highest) average = null;
  if (highest !== null && median !== null && median > highest) median = null;
  const placedPct = mode("placedPct");
  if (highest === null && average === null && median === null && placedPct === null) return null;
  const used = pick.filter((c) =>
    (c.metric === "highest" && c.value === highest) || (c.metric === "average" && c.value === average) ||
    (c.metric === "median" && c.value === median) || (c.metric === "placedPct" && c.value === placedPct));
  return { year: pick[0].year, highest, average, median, placedPct, claims: used };
}
