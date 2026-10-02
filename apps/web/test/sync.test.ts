import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BEFORE_SYNC, planSync, startSync, type RemoteItem, type SyncBackend } from "../src/lib/sync";
import { SYNC_APPLIED_EVENT, SYNCED, syncMeta, writeJson } from "../src/lib/storage";

const T1 = "2026-10-01T10:00:00.000Z";
const T2 = "2026-10-02T10:00:00.000Z";

describe("planSync (#15): the newest copy of each piece wins", () => {
  const none = () => false;

  it("pulls what only the account has, pushes what only this browser has", () => {
    const actions = planSync({ list: T1 }, (k) => k === "list", [{ key: "profile", value: { meritNumber: 5200 }, updatedAt: T1 }]);
    expect(actions).toEqual([
      { kind: "pull", key: "profile", value: { meritNumber: 5200 }, updatedAt: T1 },
      { kind: "push", key: "list", updatedAt: T1 },
    ]);
  });

  it("compares change times piece by piece", () => {
    const remote: RemoteItem[] = [
      { key: "profile", value: "account", updatedAt: T2 },
      { key: "list", value: "account", updatedAt: T1 },
      { key: "compare", value: "same", updatedAt: T1 },
    ];
    const actions = planSync({ profile: T1, list: T2, compare: T1 }, (k) => k !== "allotment" && k !== "progress", remote);
    expect(actions.map((a) => `${a.kind}:${a.key}`)).toEqual(["pull:profile", "push:list"]);
  });

  it("treats data saved before sync existed as older than any account copy", () => {
    expect(planSync({}, (k) => k === "list", [{ key: "list", value: [], updatedAt: T1 }])[0].kind).toBe("pull");
    expect(planSync({}, (k) => k === "list", [])).toEqual([{ kind: "push", key: "list", updatedAt: BEFORE_SYNC }]);
  });

  it("does nothing when neither side has anything", () => {
    expect(planSync({}, none, [])).toEqual([]);
  });

  it("pulls a cleared piece (null) when the clearing is newer", () => {
    expect(planSync({ allotment: T1 }, (k) => k === "allotment", [{ key: "allotment", value: null, updatedAt: T2 }])).toEqual([
      { kind: "pull", key: "allotment", value: null, updatedAt: T2 },
    ]);
  });
});

describe("startSync (#15)", () => {
  let store: Map<string, string>;
  let applied: number;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const win = new EventTarget();
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
    applied = 0;
    win.addEventListener(SYNC_APPLIED_EVENT, () => applied++);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fakeBackend(remote: RemoteItem[]) {
    const puts: { key: string; value: unknown; updatedAt: string }[] = [];
    const backend: SyncBackend = {
      fetchAll: async () => remote,
      put: async (key, value, updatedAt) => void puts.push({ key, value, updatedAt }),
      deleteAll: async () => undefined,
    };
    return { backend, puts };
  }

  const settle = () => new Promise((r) => setTimeout(r, 0));

  it("writes the account's newer copy here, tells the stores, and uploads this browser's newer piece", async () => {
    writeJson(SYNCED.list, [{ id: "a" }]);
    const listAt = syncMeta().list!;
    const { backend, puts } = fakeBackend([{ key: "profile", value: { meritNumber: 5200 }, updatedAt: T1 }]);
    const statuses: string[] = [];
    const s = startSync(backend, (st) => statuses.push(st), 5);
    await settle();
    await settle();
    expect(JSON.parse(store.get(SYNCED.profile)!)).toEqual({ meritNumber: 5200 });
    expect(syncMeta().profile).toBe(T1);
    expect(applied).toBe(1);
    expect(puts).toEqual([{ key: "list", value: [{ id: "a" }], updatedAt: listAt }]);
    expect(statuses.at(-1)).toBe("synced");
    s.stop();
  });

  it("uploads later changes after a short pause, and flush sends them at once", async () => {
    const { backend, puts } = fakeBackend([]);
    const s = startSync(backend, () => undefined, 10_000);
    await settle();
    writeJson(SYNCED.compare, [{ code: "16006", name: "COEP" }]);
    expect(puts).toHaveLength(0);
    await s.flush();
    expect(puts).toEqual([{ key: "compare", value: [{ code: "16006", name: "COEP" }], updatedAt: syncMeta().compare }]);
    s.stop();
  });

  it("reports an error and keeps the local copy when the account can't be reached", async () => {
    writeJson(SYNCED.list, [{ id: "a" }]);
    const backend: SyncBackend = { fetchAll: async () => { throw new Error("offline"); }, put: async () => undefined, deleteAll: async () => undefined };
    const statuses: string[] = [];
    const s = startSync(backend, (st) => statuses.push(st));
    await settle();
    expect(statuses).toEqual(["syncing", "error"]);
    expect(store.get(SYNCED.list)).toBe(JSON.stringify([{ id: "a" }]));
    s.stop();
  });
});
