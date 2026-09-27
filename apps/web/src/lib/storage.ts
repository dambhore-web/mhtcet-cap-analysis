/**
 * Safe localStorage access. Stored values can be stale (older app version), edited by hand,
 * or blocked (private mode), so every read is parsed and shape-checked; bad entries are dropped.
 */

export function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: the app keeps working in memory */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const isStr = (v: unknown): v is string => typeof v === "string";
export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const isBool = (v: unknown): v is boolean => typeof v === "boolean";

/** Keep only the array items that pass `valid`. Anything that isn't an array becomes []. */
export function validArray<T>(v: unknown, valid: (x: unknown) => x is T): T[] {
  return Array.isArray(v) ? v.filter(valid) : [];
}
