import { useEffect, useState } from "react";
import { isNum, isRecord, isStr, readJson, SYNC_APPLIED_EVENT, validArray, writeJson } from "./storage";

export interface ListItem {
  id: string;
  choiceCode: string;
  collegeCode: string;
  collegeName: string;
  branch: string;
  seatType: string;
  closingMerit: number;
  year: number;
  /** Round I and last-round closing for this seat type, when known (added after v1). */
  firstRoundClosing?: number | null;
  lastRoundClosing?: number | null;
}

const KEY = "compass_list_v1";
const CHANGE_EVENT = "compass-list-change";

/** CAP lets a candidate fill up to 300 choice codes in the option form. */
export const OPTION_FORM_MAX = 300;

function isListItem(v: unknown): v is ListItem {
  return (
    isRecord(v) &&
    isStr(v.id) && isStr(v.choiceCode) && isStr(v.collegeCode) && isStr(v.collegeName) &&
    isStr(v.branch) && isStr(v.seatType) && isNum(v.closingMerit) && isNum(v.year) &&
    (v.firstRoundClosing == null || isNum(v.firstRoundClosing)) &&
    (v.lastRoundClosing == null || isNum(v.lastRoundClosing))
  );
}

export function loadList(): ListItem[] {
  return validArray(readJson(KEY), isListItem);
}

export function saveList(items: ListItem[]): void {
  writeJson(KEY, items);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isInList(choiceCode: string): boolean {
  return loadList().some((i) => i.choiceCode === choiceCode);
}

export function isListFull(): boolean {
  return loadList().length >= OPTION_FORM_MAX;
}

/** Adds a choice unless it is already on the form or the form is full (see isListFull). */
export function addToList(item: Omit<ListItem, "id">): ListItem[] {
  const list = loadList();
  if (list.some((i) => i.choiceCode === item.choiceCode)) return list;
  if (list.length >= OPTION_FORM_MAX) return list;
  const updated = [...list, { ...item, id: `${item.choiceCode}-${Date.now()}` }];
  saveList(updated);
  return updated;
}

export function removeFromList(id: string): ListItem[] {
  const updated = loadList().filter((i) => i.id !== id);
  saveList(updated);
  return updated;
}

/** The option form, kept in sync across components and browser tabs. */
export function useList(): ListItem[] {
  const [items, setItems] = useState<ListItem[]>(() => loadList());
  useEffect(() => {
    const refresh = () => setItems(loadList());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener(SYNC_APPLIED_EVENT, refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SYNC_APPLIED_EVENT, refresh);
    };
  }, []);
  return items;
}

/** The option-form entry for a rank-finder result. */
export function listItemFrom(o: {
  choiceCode: string;
  collegeCode: string;
  collegeName: string;
  branch: string;
  seatType: string;
  closingMerit: number;
  year: number;
  firstRoundClosing?: number | null;
  lastRoundClosing?: number | null;
}): Omit<ListItem, "id"> {
  return {
    choiceCode: o.choiceCode,
    collegeCode: o.collegeCode,
    collegeName: o.collegeName,
    branch: o.branch,
    seatType: o.seatType,
    closingMerit: o.closingMerit,
    year: o.year,
    firstRoundClosing: o.firstRoundClosing ?? null,
    lastRoundClosing: o.lastRoundClosing ?? null,
  };
}
