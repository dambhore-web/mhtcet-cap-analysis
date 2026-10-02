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
  changedLocally(key);
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  changedLocally(key);
}

/* ── Account sync (#15) ──────────────────────────────────────────────────
   The pieces that follow a signed-in student across devices. Every local change to one of them
   is stamped with the time, so on sign-in the newest copy of each piece wins (lib/sync.ts). */

export const SYNCED = {
  profile: "compass_profile_v1",
  list: "compass_list_v1",
  compare: "compass_compare_v1",
  allotment: "compass_allotment_v1",
  progress: "compass_progress_v1",
} as const;
export type SyncKey = keyof typeof SYNCED;
export const SYNC_KEYS = Object.keys(SYNCED) as SyncKey[];

const META_KEY = "compass_sync_meta_v1";
/** Fired with `detail: SyncKey` when the student changes a synced piece on this device. */
export const LOCAL_CHANGE_EVENT = "compass-local-change";
/** Fired after sync has written the account's copies into this browser: stores reload. */
export const SYNC_APPLIED_EVENT = "compass-sync-applied";

const syncKeyOf = (storageKey: string): SyncKey | null => SYNC_KEYS.find((k) => SYNCED[k] === storageKey) ?? null;

/** When each synced piece last changed here (ISO time), as far as this browser knows. */
export function syncMeta(): Partial<Record<SyncKey, string>> {
  const v = readJson(META_KEY);
  if (!isRecord(v)) return {};
  const out: Partial<Record<SyncKey, string>> = {};
  for (const k of SYNC_KEYS) if (isStr(v[k])) out[k] = v[k];
  return out;
}

function stamp(k: SyncKey, at: string) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ ...syncMeta(), [k]: at }));
  } catch {
    /* ignore */
  }
}

function changedLocally(storageKey: string) {
  const k = syncKeyOf(storageKey);
  if (!k) return;
  stamp(k, new Date().toISOString());
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: k }));
}

/** Write the account's copy of a piece without counting it as a local change. */
export function applySynced(k: SyncKey, value: unknown, updatedAt: string) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(SYNCED[k]);
    else localStorage.setItem(SYNCED[k], JSON.stringify(value));
  } catch {
    /* ignore */
  }
  stamp(k, updatedAt);
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
