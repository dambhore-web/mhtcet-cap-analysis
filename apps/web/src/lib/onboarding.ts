import type { Category } from "./api";
import type { Profile } from "./profile";

/**
 * The one-question-per-screen onboarding (#142): which steps a student sees, and how their
 * answers become a saved profile and the Find colleges URL (Find runs the search from the URL).
 */

export type StepId = "exam" | "have" | "score" | "category" | "gender" | "university" | "special" | "minority" | "branches";

export type Flags = { ews: boolean; tfws: boolean; defence: boolean; pwd: boolean; orphan: boolean };

export interface Answers {
  /** MH: MHT-CET state merit list (state-quota seats). AI: All India merit list (JEE Main, All India seats). */
  exam: "MH" | "AI";
  /** Whether the student has their merit number, or only a percentile (merit list not out yet). */
  have: "merit" | "percentile";
  merit: string;
  percentile: string;
  subjectGroup: "PCM" | "PCB";
  /** Merit number estimated from the percentile, as a range; the search uses its middle. */
  estimate: [number, number] | null;
  category: Category | "";
  gender: "M" | "F";
  homeUniversity: string;
  flags: Flags;
  /** Minority community as the CAP lists spell it, or "" for none. */
  minority: string;
  branchGroups: string[];
}

export const EMPTY_ANSWERS: Answers = {
  exam: "MH",
  have: "merit",
  merit: "",
  percentile: "",
  subjectGroup: "PCM",
  estimate: null,
  category: "",
  gender: "M",
  homeUniversity: "",
  flags: { ews: false, tfws: false, defence: false, pwd: false, orphan: false },
  minority: "",
  branchGroups: [],
};

const ALL_STEPS: StepId[] = ["exam", "have", "score", "category", "gender", "university", "special", "minority", "branches"];

/** All India seats don't depend on category, gender, university, special seats or minority, so JEE skips them. */
export function visibleSteps(a: Answers): StepId[] {
  if (a.exam === "AI") return ["exam", "have", "score", "branches"];
  return ALL_STEPS;
}

/** A merit number typed by the student ("12,450" → 12450), or null if it isn't one. */
export function parseMerit(raw: string): number | null {
  const s = raw.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 1 ? n : null;
}

/** A percentile between 0 (exclusive) and 100, or null. */
export function parsePercentile(raw: string): number | null {
  const n = parseFloat(raw.trim());
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

/** The merit number to search with: the one typed, or the middle of the estimated range. */
export function searchMerit(a: Answers): number | null {
  if (a.have === "merit") return parseMerit(a.merit);
  return a.estimate ? Math.round((a.estimate[0] + a.estimate[1]) / 2) : null;
}

/** EWS is only for Open-category candidates. */
export function ewsAllowed(a: Answers): boolean {
  return a.category === "";
}

/**
 * The profile saved on this device. Only a real state merit number is saved: an estimate or an
 * All India merit number would be wrong on pages that read `meritNumber` as the state merit number.
 */
export function toProfile(a: Answers): Profile {
  const mh = a.exam === "MH";
  return {
    meritNumber: mh && a.have === "merit" ? parseMerit(a.merit) : null,
    category: mh ? a.category || null : null,
    gender: a.gender,
    subjectGroup: a.subjectGroup,
    homeUniversity: mh ? a.homeUniversity : "",
    ews: mh && ewsAllowed(a) && a.flags.ews,
    tfws: mh && a.flags.tfws,
    defence: mh && a.flags.defence,
    pwd: mh && a.flags.pwd,
    orphan: mh && a.flags.orphan,
    minorityCommunity: mh && a.minority ? a.minority : null,
  };
}

/** The Find colleges URL parameters (the same names Find already reads), plus `bg` and `scan`. */
export function toFindParams(a: Answers): URLSearchParams | null {
  const merit = searchMerit(a);
  if (merit == null) return null;
  const p = new URLSearchParams({ merit: String(merit) });
  if (a.exam === "AI") p.set("list", "AI");
  if (a.have === "percentile") p.set("est", "1");
  if (a.subjectGroup !== "PCM") p.set("subj", a.subjectGroup);
  if (a.exam === "MH") {
    if (a.category) p.set("cat", a.category);
    if (a.gender !== "M") p.set("gen", a.gender);
    if (a.homeUniversity) p.set("hu", a.homeUniversity);
    if (a.flags.ews && ewsAllowed(a)) p.set("ews", "1");
    if (a.flags.tfws) p.set("tfws", "1");
    if (a.flags.defence) p.set("def", "1");
    if (a.flags.pwd) p.set("pwd", "1");
    if (a.flags.orphan) p.set("orphan", "1");
    if (a.minority) p.set("min", a.minority);
  }
  if (a.branchGroups.length) p.set("bg", a.branchGroups.join(","));
  p.set("scan", "1");
  return p;
}

/** Branch groups from a `bg` URL parameter, keeping only known groups. */
export function parseBranchGroups(raw: string | null, known: readonly string[]): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((g) => g.trim()).filter((g) => known.includes(g)))];
}

/** The Find colleges link for a saved profile ("Continue to my results"), or null without a merit number. */
export function profileResultsPath(p: Profile): string | null {
  if (!p.meritNumber) return null;
  const q = new URLSearchParams({ merit: String(p.meritNumber) });
  if (p.category) q.set("cat", p.category);
  if (p.gender !== "M") q.set("gen", p.gender);
  if (p.subjectGroup !== "PCM") q.set("subj", p.subjectGroup);
  if (p.homeUniversity) q.set("hu", p.homeUniversity);
  if (p.ews && !p.category) q.set("ews", "1");
  if (p.tfws) q.set("tfws", "1");
  if (p.defence) q.set("def", "1");
  if (p.pwd) q.set("pwd", "1");
  if (p.orphan) q.set("orphan", "1");
  if (p.minorityCommunity) q.set("min", p.minorityCommunity);
  return `/find?${q.toString()}`;
}
