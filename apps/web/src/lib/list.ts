import { isNum, isRecord, isStr, readJson, validArray, writeJson } from "./storage";

export interface ListItem {
  id: string;
  choiceCode: string;
  collegeCode: string;
  collegeName: string;
  branch: string;
  seatType: string;
  closingMerit: number;
  year: number;
}

const KEY = "compass_list_v1";

function isListItem(v: unknown): v is ListItem {
  return (
    isRecord(v) &&
    isStr(v.id) && isStr(v.choiceCode) && isStr(v.collegeCode) && isStr(v.collegeName) &&
    isStr(v.branch) && isStr(v.seatType) && isNum(v.closingMerit) && isNum(v.year)
  );
}

export function loadList(): ListItem[] {
  return validArray(readJson(KEY), isListItem);
}

export function saveList(items: ListItem[]): void {
  writeJson(KEY, items);
}

export function isInList(choiceCode: string): boolean {
  return loadList().some((i) => i.choiceCode === choiceCode);
}

export function addToList(item: Omit<ListItem, "id">): ListItem[] {
  const list = loadList();
  if (list.some((i) => i.choiceCode === item.choiceCode)) return list;
  const updated = [...list, { ...item, id: `${item.choiceCode}-${Date.now()}` }];
  saveList(updated);
  return updated;
}

export function removeFromList(id: string): ListItem[] {
  const updated = loadList().filter((i) => i.id !== id);
  saveList(updated);
  return updated;
}
