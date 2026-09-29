import type { Candidature, Category } from "./api";
import { CATEGORY_OPTIONS, FLAG_OPTIONS, MINORITY_OPTIONS } from "./categories";
import { formatNumber } from "./format";

/** The step-by-step answers, as the answer tiles on Find colleges show and change them. */
export interface TileAnswers {
  exam: Candidature;
  category: Category | "";
  gender: "M" | "F";
  homeUniversity: string;
  ews: boolean;
  tfws: boolean;
  defence: boolean;
  pwd: boolean;
  orphan: boolean;
  /** Minority community as the CAP lists spell it, or "" for none. */
  minority: string;
}

export type SeatFlag = (typeof FLAG_OPTIONS)[number]["key"];

/** Special seats that apply: EWS counts only for Open-category candidates. */
export function activeFlags(a: TileAnswers): SeatFlag[] {
  return FLAG_OPTIONS.map((f) => f.key).filter((k) => a[k] && (k !== "ews" || !a.category));
}

/** "TFWS, Defence", or "None". */
export function specialSeatsLabel(a: TileAnswers): string {
  const on = activeFlags(a);
  return on.length ? on.map((k) => FLAG_OPTIONS.find((f) => f.key === k)!.label).join(", ") : "None";
}

/** "Computer & IT, Mechanical", or "All branches". */
export function branchesLabel(groups: readonly string[]): string {
  return groups.length ? groups.join(", ") : "All branches";
}

export function categoryLabel(category: Category | ""): string {
  return CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? "Open";
}

export function minorityLabel(minority: string): string {
  return minority ? MINORITY_OPTIONS.find((m) => m.value === minority)?.label ?? minority : "None";
}

/** One line for the folded tiles on a phone: "12,450 · OBC · Female · SPPU area · TFWS". */
export function answersSummary(a: TileAnswers, merit: number | null, groups: readonly string[]): string {
  const parts: string[] = [merit ? `${a.exam === "AI" ? "All India " : ""}${formatNumber(merit)}` : "No merit number yet"];
  if (a.exam === "AI") {
    parts.push("JEE Main");
  } else {
    parts.push(categoryLabel(a.category));
  }
  parts.push(a.gender === "F" ? "Female" : "Male");
  if (a.exam === "MH") {
    if (a.homeUniversity) parts.push(a.homeUniversity);
    parts.push(...activeFlags(a).map((k) => FLAG_OPTIONS.find((f) => f.key === k)!.label));
    if (a.minority) parts.push(minorityLabel(a.minority));
  }
  if (groups.length) parts.push(branchesLabel(groups));
  return parts.join(" · ");
}
