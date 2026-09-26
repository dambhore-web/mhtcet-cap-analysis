import { computeCutoffs, type AllotmentRow, type CutoffRow } from "@mhtcet/core";

/**
 * Cross-check: closing merit computed from institute-wise allotment lists vs the official
 * cutoff lists, per round x choice code x section x seat type.
 *
 * Mapping between the two sources (observed 2026):
 * - TFWS allotment lists use their own choice code ending `1T`; the official lists print TFWS as a
 *   column of the regular branch (code ending `0`).
 * - Allotment section "State Level Seats" = official "State Level"; HU / OHU section labels are
 *   printed identically; the All India allotment section maps to the AI list, section `AI to AI`.
 * - The official list prints one value per stage; the comparable figure is the highest (worst)
 *   closing merit over the stages of that round.
 * - Standalone seat types (TFWS, EWS, MI, ORPHANI, ORPHANN) are printed under different section
 *   labels in the two sources (e.g. "Minority Seats Allotted to Minority Candidates", "ORPHAN
 *   Seats"), so they are compared across sections.
 * - Allotment lists are cumulative (everyone holding a seat after the round), while the official
 *   round-N list covers allotments made in round N. The computed round-N value therefore uses
 *   only rows that are new in round N: (merit, choice code, seat type) not present in round N-1.
 */

const PREVIOUS: Record<string, string> = { II: "I", III: "II", IV: "III", V: "IV", VI: "V" };

/** Rows allotted in their round: all Round I rows, and later rows absent from the previous round. */
export function newInRound(rows: readonly AllotmentRow[]): AllotmentRow[] {
  const key = (r: AllotmentRow): string => `${r.collegeCode}|${r.round}|${r.merit}|${r.choiceCode}|${r.seatType}`;
  const all = new Set(rows.map(key));
  return rows.filter((r) => {
    const prev = PREVIOUS[r.round];
    return !prev || !all.has(key({ ...r, round: prev as AllotmentRow["round"] }));
  });
}

const STANDALONE_ANY_SECTION = /^(TFWS|EWS|MI|ORPHANI|ORPHANN)$/;
const sectionKey = (section: string, seatType: string): string => (STANDALONE_ANY_SECTION.test(seatType) ? "*" : section);

export interface CrossCheckRow {
  round: string;
  choiceCode: string;
  section: string;
  seatType: string;
  computed: number | null;
  official: number | null;
  seatsFilled: number;
  status: "match" | "mismatch" | "missing-official" | "missing-computed";
}

/** TFWS list codes end in `1T` (or `1<suffix>T`, e.g. `0600721971UT`); the official lists use `0<suffix>`. */
export function normaliseChoiceCode(code: string): string {
  return code.replace(/1([A-Z]*)T$/, "0$1");
}

export function normaliseSection(section: string): { list: "MH" | "AI"; section: string } {
  const s = section.trim();
  if (/^All India Seats/i.test(s)) return { list: "AI", section: "AI to AI" };
  if (/^Maharashtra State Seats Allotted to All India/i.test(s)) return { list: "AI", section: "MH to AI" };
  if (/^State Level Seats$/i.test(s)) return { list: "MH", section: "State Level" };
  return { list: "MH", section: s };
}

export function crossCheck(allotment: readonly AllotmentRow[], official: readonly CutoffRow[], collegeCode: string): CrossCheckRow[] {
  const rows = newInRound(allotment.filter((r) => r.collegeCode === collegeCode)).map((r) => ({
    ...r,
    choiceCode: normaliseChoiceCode(r.choiceCode),
    section: sectionKey(normaliseSection(r.section).section, r.seatType ?? ""),
  }));
  const computed = computeCutoffs(rows);
  const off = new Map<string, number>();
  for (const c of official) {
    if (c.collegeCode !== collegeCode || c.list === "Diploma") continue;
    const key = [c.round, c.choiceCode, sectionKey(c.section, c.seatType), c.seatType].join("|");
    off.set(key, Math.max(off.get(key) ?? 0, c.closingMerit));
  }
  const out: CrossCheckRow[] = [];
  const seen = new Set<string>();
  for (const c of computed) {
    const key = [c.round, c.choiceCode, c.section, c.seatType].join("|");
    seen.add(key);
    const o = off.get(key) ?? null;
    out.push({
      round: c.round, choiceCode: c.choiceCode, section: c.section, seatType: c.seatType,
      computed: c.closingMerit, official: o, seatsFilled: c.seatsFilled,
      status: o === null ? "missing-official" : o === c.closingMerit ? "match" : "mismatch",
    });
  }
  for (const [key, o] of off) {
    if (seen.has(key)) continue;
    const [round, choiceCode, section, seatType] = key.split("|");
    out.push({ round, choiceCode, section, seatType, computed: null, official: o, seatsFilled: 0, status: "missing-computed" });
  }
  return out;
}
