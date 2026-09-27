import type { Round } from "@mhtcet/core";
import type { ListItem } from "./list";
import type { Advice } from "./allotment";

/**
 * A family summary (journey J11) small enough to live in a link. It holds public college data and
 * the student's merit number and category only: no name, no application ID (ADR-003).
 */
export interface SummaryChoice {
  choiceCode: string;
  collegeCode: string;
  collegeName: string;
  branch: string;
  seatType: string;
  firstRoundClosing: number | null;
  lastRoundClosing: number;
}

export interface Summary {
  v: 1;
  merit: number | null;
  category: string;
  gender: "M" | "F";
  preparedOn: string;
  allotment: { round: Round; preference: number; advice: Advice } | null;
  choices: SummaryChoice[];
}

export const SUMMARY_TOP = 6;

export function buildSummary(args: {
  merit: number | null;
  category: string;
  gender: "M" | "F";
  items: ListItem[];
  allotment: { round: Round; preference: number; advice: Advice } | null;
  today?: Date;
}): Summary {
  const topN = Math.max(SUMMARY_TOP, args.allotment?.preference ?? 0);
  return {
    v: 1,
    merit: args.merit,
    category: args.category,
    gender: args.gender,
    preparedOn: (args.today ?? new Date()).toISOString().slice(0, 10),
    allotment: args.allotment,
    choices: args.items.slice(0, topN).map((i) => ({
      choiceCode: i.choiceCode,
      collegeCode: i.collegeCode,
      collegeName: i.collegeName,
      branch: i.branch,
      seatType: i.seatType,
      firstRoundClosing: i.firstRoundClosing ?? null,
      lastRoundClosing: i.lastRoundClosing ?? i.closingMerit,
    })),
  };
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeSummary(s: Summary): string {
  return toBase64Url(JSON.stringify(s));
}

/** Parses a shared summary; anything malformed returns null. */
export function decodeSummary(param: string | null): Summary | null {
  if (!param) return null;
  try {
    const v = JSON.parse(fromBase64Url(param)) as Summary;
    if (v?.v !== 1 || !Array.isArray(v.choices) || v.choices.length > 300) return null;
    const ok = v.choices.every((c) => typeof c.choiceCode === "string" && typeof c.collegeName === "string" && typeof c.branch === "string" && typeof c.lastRoundClosing === "number");
    return ok ? v : null;
  } catch {
    return null;
  }
}
