import { useEffect, useState } from "react";
import { autoFreezes, type Round } from "@mhtcet/core";
import type { ListItem } from "./list";
import { isRecord, isStr, readJson, removeKey, SYNC_APPLIED_EVENT, writeJson } from "./storage";

/** The seat the student was allotted, as entered on the After allotment step. */
export interface Allotment {
  round: Round;
  choiceCode: string;
}

const KEY = "compass_allotment_v1";
const EVENT = "compass-allotment-change";
const ROUNDS: Round[] = ["I", "II", "III", "IV"];

export function loadAllotment(): Allotment | null {
  const v = readJson(KEY);
  if (!isRecord(v) || !isStr(v.choiceCode) || !ROUNDS.includes(v.round as Round)) return null;
  return { round: v.round as Round, choiceCode: v.choiceCode };
}

export function saveAllotment(a: Allotment | null) {
  if (a) writeJson(KEY, a);
  else removeKey(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function useAllotment(): Allotment | null {
  const [a, setA] = useState(loadAllotment);
  useEffect(() => {
    const f = () => setA(loadAllotment());
    window.addEventListener(EVENT, f);
    window.addEventListener(SYNC_APPLIED_EVENT, f);
    // re-read once: a change between the first render and this subscription would otherwise be missed
    f();
    return () => {
      window.removeEventListener(EVENT, f);
      window.removeEventListener(SYNC_APPLIED_EVENT, f);
    };
  }, []);
  return a;
}

export type Advice = "frozen" | "freeze" | "float" | "slide" | "final";

export interface HigherOption {
  item: ListItem;
  preference: number;
  /** Did this choice admit the student's merit by the last round last year? */
  openedLastYear: boolean | null;
}

export interface AllotmentAnalysis {
  preference: number;
  item: ListItem;
  autoFrozen: boolean;
  higher: HigherOption[];
  advice: Advice;
  /** Higher choices that opened last year are all at the allotted college (Slide reaches them). */
  sameCollegeOnly: boolean;
}

/**
 * What the student can do after an allotment, from the CAP auto-freeze rule and last year's
 * closing ranks for the choices above their seat. History, not a prediction.
 */
export function analyseAllotment(items: ListItem[], a: Allotment, merit: number | null): AllotmentAnalysis | null {
  const idx = items.findIndex((i) => i.choiceCode === a.choiceCode);
  if (idx === -1) return null;
  const preference = idx + 1;
  const item = items[idx];
  const autoFrozen = autoFreezes(a.round, preference);
  const higher: HigherOption[] = items.slice(0, idx).map((it, i) => {
    const last = it.lastRoundClosing ?? it.closingMerit;
    return { item: it, preference: i + 1, openedLastYear: merit ? merit <= last : null };
  });
  const opened = higher.filter((h) => h.openedLastYear);
  const sameCollegeOnly = opened.length > 0 && opened.every((h) => h.item.collegeCode === item.collegeCode);

  let advice: Advice;
  if (a.round === "IV") advice = "final";
  else if (autoFrozen) advice = "frozen";
  else if (preference === 1 || (merit != null && opened.length === 0)) advice = "freeze";
  else if (sameCollegeOnly) advice = "slide";
  else advice = "float";

  return { preference, item, autoFrozen, higher, advice, sameCollegeOnly };
}
