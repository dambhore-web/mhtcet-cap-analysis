import { bandOf, branchGroupOf, firstFreezeRound, type Band, type RankStatus, type Round } from "@mhtcet/core";
import { OPTION_FORM_MAX, type ListItem } from "./list";

export type Reach = "round-I" | "later" | "out" | "unknown";

/** Would last year's closing ranks have admitted this merit number, and when? */
export function reachOf(item: ListItem, merit: number | null): Reach {
  if (!merit) return "unknown";
  const first = item.firstRoundClosing ?? null;
  const last = item.lastRoundClosing ?? item.closingMerit;
  if (first != null && merit <= first) return "round-I";
  if (merit <= last) return "later";
  return "out";
}

/** Freeze-zone marker for a 1-based preference: the first round in which it would auto-freeze. */
export function freezeRoundOf(preference: number): Round | null {
  return firstFreezeRound(preference);
}

export interface ListCheck {
  level: "warn" | "info";
  text: string;
}

/** Plain-language checks on the order of the option form. */
export function listChecks(items: ListItem[], merit: number | null): ListCheck[] {
  const out: ListCheck[] = [];
  if (items.length === 0) return out;
  if (!merit) {
    out.push({ level: "info", text: "Add your merit number to see which choices were within reach last year." });
    return out;
  }
  const reaches = items.map((it) => reachOf(it, merit));
  const firstSafe = reaches.indexOf("round-I");
  const anyReach = reaches.some((r) => r === "round-I" || r === "later");

  if (!anyReach) {
    out.push({ level: "warn", text: "None of your choices admitted your merit number last year, in any round. Add a few choices within reach as a safety net." });
  } else if (firstSafe === -1) {
    out.push({ level: "warn", text: "No choice was within reach in Round I last year. Consider adding one you would have got in Round I." });
  }

  if (firstSafe !== -1 && firstSafe < items.length - 1) {
    const below = items.length - 1 - firstSafe;
    out.push({
      level: "info",
      text: `Choice ${firstSafe + 1} admitted your merit number in Round I last year, so the ${below} ${below === 1 ? "choice" : "choices"} below it would probably never be used. That's fine if they are backups.`,
    });
  }

  if (reaches[0] === "round-I") {
    out.push({ level: "info", text: "Your first choice was within reach in Round I. If you get it, the seat freezes automatically and you won't move to any other choice." });
  }
  return out;
}

/* ── Coverage (#137): how the list is spread, not just how it is ordered ── */

export interface Share {
  name: string;
  count: number;
  /** 0–1 of the choices it was counted over */
  share: number;
}

export interface ListCoverage {
  size: number;
  max: number;
  /** Likely / Target / Reach / Out counts, or null without a merit number */
  bands: Record<Band, number> | null;
  groups: { distinct: number; top: Share };
  /** null until the colleges' districts are known */
  districts: { distinct: number; top: Share; known: number } | null;
}

const STATUS_OF: Record<Exclude<Reach, "unknown">, RankStatus> = { "round-I": "round-I", later: "later-round", out: "out-of-range" };

/** The band of one choice, from the same rule as the Find results tiles. */
export function bandOfItem(item: ListItem, merit: number): Band {
  const reach = reachOf(item, merit) as Exclude<Reach, "unknown">;
  return bandOf(STATUS_OF[reach], merit, item.lastRoundClosing ?? item.closingMerit);
}

function topOf(values: string[]): { distinct: number; top: Share } {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let top: Share = { name: "", count: 0, share: 0 };
  for (const [name, count] of counts) if (count > top.count) top = { name, count, share: count / values.length };
  return { distinct: counts.size, top };
}

/**
 * Coverage of a non-empty list. `districtOf` maps a college code to its district (null when not known);
 * district shares are over the choices whose district is known.
 */
export function listCoverage(items: ListItem[], merit: number | null, districtOf?: (collegeCode: string) => string | null): ListCoverage {
  let bands: Record<Band, number> | null = null;
  if (merit) {
    bands = { likely: 0, target: 0, reach: 0, out: 0 };
    for (const it of items) bands[bandOfItem(it, merit)]++;
  }
  let districts: ListCoverage["districts"] = null;
  if (districtOf) {
    const known = items.map((it) => districtOf(it.collegeCode)).filter((d): d is string => !!d);
    if (known.length > 0) districts = { ...topOf(known), known: known.length };
  }
  return {
    size: items.length,
    max: OPTION_FORM_MAX,
    bands,
    groups: topOf(items.map((it) => branchGroupOf(it.branch))),
    districts,
  };
}

/** Below this many choices, a lopsided spread is expected and not worth a warning. */
export const COVERAGE_MIN_CHOICES = 5;
/** Share of one branch group above which the list is called narrow (#137). */
export const NARROW_GROUP_SHARE = 0.8;

/** Neighbouring branch groups a student might accept instead, for the narrow-list suggestion. */
const NEIGHBOURS: Record<string, string> = {
  "Computer & IT": "Electronics & Telecom",
  "Electronics & Telecom": "Computer & IT or Electrical",
  Electrical: "Electronics & Telecom or Instrumentation",
  Instrumentation: "Electrical or Electronics & Telecom",
  Mechanical: "Production, Automobile or Aerospace",
  Aerospace: "Mechanical",
};

/** Suggestions from the coverage, worded as options, never orders. "No Likely choice" stays in listChecks. */
export function coverageChecks(c: ListCoverage): ListCheck[] {
  const out: ListCheck[] = [];
  if (c.size < COVERAGE_MIN_CHOICES) return out;
  const g = c.groups.top;
  if (g.share > NARROW_GROUP_SHARE && g.name !== "Other") {
    const pct = Math.round(g.share * 100);
    const alt = NEIGHBOURS[g.name];
    out.push({
      level: "info",
      text: `${pct}% of your choices are ${g.name} branches. ${alt ? `If ${alt} branches are acceptable to you, adding some` : "If other branches are acceptable to you, adding some"} widens your chances.`,
    });
  }
  const d = c.districts;
  if (d && d.distinct === 1 && d.known >= COVERAGE_MIN_CHOICES) {
    out.push({
      level: "info",
      text: `All your choices are in ${d.top.name} district. That's fine if you want to study there; if you would move, colleges in other districts widen your chances.`,
    });
  }
  return out;
}
