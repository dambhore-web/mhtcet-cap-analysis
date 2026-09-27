import { isRecord, isStr, readJson, validArray, writeJson } from "./storage";

export interface PinnedCollege {
  code: string;
  name: string;
}

const KEY = "compass_compare_v1";
const MAX = 3;

function isPinnedCollege(v: unknown): v is PinnedCollege {
  return isRecord(v) && isStr(v.code) && isStr(v.name);
}

export function loadPinned(): PinnedCollege[] {
  return validArray(readJson(KEY), isPinnedCollege).slice(0, MAX);
}

function savePinned(list: PinnedCollege[]) {
  writeJson(KEY, list);
}

export function pinCollege(college: PinnedCollege): PinnedCollege[] {
  const list = loadPinned();
  if (list.some((c) => c.code === college.code)) return list;
  const updated = [...list, college].slice(0, MAX);
  savePinned(updated);
  return updated;
}

export function unpinCollege(code: string): PinnedCollege[] {
  const updated = loadPinned().filter((c) => c.code !== code);
  savePinned(updated);
  return updated;
}

export function isPinned(code: string): boolean {
  return loadPinned().some((c) => c.code === code);
}
