import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applySynced, LOCAL_CHANGE_EVENT, readJson, stampSynced, SYNC_APPLIED_EVENT, SYNC_KEYS, SYNCED, syncMeta, type SyncKey,
} from "./storage";

/**
 * Account sync (#15): details, option form, compare list, allotment and progress follow a signed-in
 * student. Each piece syncs on its own and the newest copy wins (owner decision 2026-10-02); the
 * database applies the same rule (put_user_item), so an older device can't overwrite a newer one.
 */

export interface RemoteItem {
  key: SyncKey;
  value: unknown;
  updatedAt: string;
}

export type SyncAction =
  | { kind: "pull"; key: SyncKey; value: unknown; updatedAt: string }
  | { kind: "push"; key: SyncKey; updatedAt: string };

/** Data saved before sync existed has no time: any copy in the account is newer. */
export const BEFORE_SYNC = "1970-01-01T00:00:00.000Z";

/**
 * What to do with each piece. `stamps` are this browser's change times, `hasLocal` whether the
 * piece exists here. Equal times mean the copies match.
 */
export function planSync(stamps: Partial<Record<SyncKey, string>>, hasLocal: (k: SyncKey) => boolean, remote: RemoteItem[]): SyncAction[] {
  const byKey = new Map(remote.map((r) => [r.key, r]));
  const out: SyncAction[] = [];
  for (const key of SYNC_KEYS) {
    const r = byKey.get(key);
    const local = stamps[key] ?? (hasLocal(key) ? BEFORE_SYNC : null);
    if (r && (local === null || Date.parse(r.updatedAt) > Date.parse(local))) out.push({ kind: "pull", key, value: r.value, updatedAt: r.updatedAt });
    else if (local !== null && (!r || Date.parse(local) > Date.parse(r.updatedAt))) out.push({ kind: "push", key, updatedAt: local });
  }
  return out;
}

/** Where the account's copies live. Supabase in the app, a fake in tests. */
export interface SyncBackend {
  fetchAll(): Promise<RemoteItem[]>;
  put(key: SyncKey, value: unknown, updatedAt: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export function supabaseBackend(sb: SupabaseClient, userId: string): SyncBackend {
  return {
    async fetchAll() {
      const { data, error } = await sb.from("user_store").select("key, value, updated_at");
      if (error) throw error;
      return (data ?? [])
        .filter((r) => (SYNC_KEYS as string[]).includes(r.key))
        .map((r) => ({ key: r.key as SyncKey, value: r.value, updatedAt: new Date(r.updated_at).toISOString() }));
    },
    async put(key, value, updatedAt) {
      const { error } = await sb.rpc("put_user_item", { p_key: key, p_value: value ?? null, p_updated_at: updatedAt });
      if (error) throw error;
    },
    async deleteAll() {
      const { error } = await sb.from("user_store").delete().eq("user_id", userId);
      if (error) throw error;
    },
  };
}

export type SyncStatus = "syncing" | "synced" | "error";

export interface SyncSession {
  /** Push any change still waiting for its debounce. */
  flush(): Promise<void>;
  stop(): void;
}

const hasLocal = (k: SyncKey) => readJson(SYNCED[k]) !== null;

/** Pull, push and keep pushing local changes while signed in. */
export function startSync(backend: SyncBackend, onStatus: (s: SyncStatus) => void, debounceMs = 800): SyncSession {
  const pending = new Map<SyncKey, ReturnType<typeof setTimeout>>();
  let stopped = false;

  const push = async (key: SyncKey) => {
    pending.delete(key);
    const at = syncMeta()[key] ?? new Date().toISOString();
    await backend.put(key, readJson(SYNCED[key]), at);
  };

  const run = async (work: () => Promise<void>) => {
    onStatus("syncing");
    try {
      await work();
      if (!stopped) onStatus("synced");
    } catch {
      if (!stopped) onStatus("error");
    }
  };

  const syncAll = () =>
    run(async () => {
      const actions = planSync(syncMeta(), hasLocal, await backend.fetchAll());
      if (stopped) return;
      let pulled = false;
      for (const a of actions) {
        if (a.kind === "pull") {
          applySynced(a.key, a.value, a.updatedAt);
          pulled = true;
        }
      }
      if (pulled) window.dispatchEvent(new Event(SYNC_APPLIED_EVENT));
      for (const a of actions) {
        if (a.kind !== "push") continue;
        // data saved before sync existed goes up with today's time, so it beats other devices' old copies
        let at = a.updatedAt;
        if (at === BEFORE_SYNC) {
          at = new Date().toISOString();
          stampSynced(a.key, at);
        }
        await backend.put(a.key, readJson(SYNCED[a.key]), at);
      }
    });

  const onLocal = (e: Event) => {
    const key = (e as CustomEvent<SyncKey>).detail;
    clearTimeout(pending.get(key));
    pending.set(key, setTimeout(() => void run(() => push(key)), debounceMs));
  };
  // back on this tab: another device may have changed something
  const onVisible = () => {
    if (document.visibilityState === "visible") void syncAll();
  };

  window.addEventListener(LOCAL_CHANGE_EVENT, onLocal);
  document.addEventListener("visibilitychange", onVisible);
  void syncAll();

  return {
    async flush() {
      const keys = [...pending.keys()];
      for (const k of keys) clearTimeout(pending.get(k));
      if (keys.length) await run(async () => {
        for (const k of keys) await push(k);
      });
    },
    stop() {
      stopped = true;
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
      window.removeEventListener(LOCAL_CHANGE_EVENT, onLocal);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}

/** Remove the synced pieces from this browser (sign-out), without counting it as a change. */
export function clearSyncedLocally() {
  for (const k of SYNC_KEYS) {
    try {
      localStorage.removeItem(SYNCED[k]);
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem("compass_sync_meta_v1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SYNC_APPLIED_EVENT));
}
