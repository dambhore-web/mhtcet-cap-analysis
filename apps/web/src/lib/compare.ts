export interface PinnedCollege {
  code: string;
  name: string;
}

const KEY = "compass_compare_v1";
const MAX = 3;

export function loadPinned(): PinnedCollege[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PinnedCollege[]) : [];
  } catch {
    return [];
  }
}

function savePinned(list: PinnedCollege[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
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
