import { describe, it, expect, beforeAll } from "vitest";
import type { Hono } from "hono";
import type pg from "pg";
import { createApp } from "../src/app.ts";
import { demoCache, demoChoiceCode } from "../src/demo/demoCache.ts";

/** Behaviour over the demo dataset: the same data the Playwright suite uses. */
let app: Hono;
const emptyPool = { query: async () => ({ rows: [] }) } as unknown as pg.Pool;

beforeAll(() => {
  app = createApp(demoCache(), emptyPool);
});

async function post(path: string, body: unknown) {
  const res = await app.request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

const candidate = {
  merit: 5200,
  homeUniversity: "Savitribai Phule Pune University",
  category: null,
  gender: "M",
  minorityCommunity: null,
  flags: {},
  subjectGroup: "PCM",
};

describe("rank finder on demo data", () => {
  it("returns Round I and last-round closing with the source list for each option", async () => {
    const { status, body } = await post("/api/rank-finder", candidate);
    expect(status).toBe(200);
    const o = body.options[0];
    expect(o.firstRoundClosing).toBeTypeOf("number");
    expect(o.lastRoundClosing).toBeGreaterThanOrEqual(o.firstRoundClosing);
    expect(o.rounds.map((r: { round: string }) => r.round)).toEqual(["I", "II", "III", "IV"]);
    expect(o.source.file).toMatch(/cutoff-list-round-I{1,3}V?-MH\.pdf/);
    expect(o.source.page).toBeTypeOf("number");
    expect(o.list).toBe("MH");
  });

  it("matches All India candidates against All India seats only (#8)", async () => {
    const { body } = await post("/api/rank-finder", { ...candidate, merit: 9000, candidature: "AI" });
    expect(body.count).toBeGreaterThan(0);
    expect(body.options.every((o: { seatType: string; list: string }) => o.seatType === "AI" && o.list === "AI")).toBe(true);
  });

  it("state candidates never get All India seats", async () => {
    const { body } = await post("/api/rank-finder", candidate);
    expect(body.options.some((o: { seatType: string }) => o.seatType === "AI")).toBe(false);
  });

  it("filters by district", async () => {
    const { body } = await post("/api/rank-finder", { ...candidate, filters: { district: "Pune" } });
    expect(body.count).toBeGreaterThan(0);
    expect(body.options.every((o: { district: string }) => o.district === "Pune")).toBe(true);
  });
});

describe("simulator on demo data (#36)", () => {
  it("replays Rounds I–IV and applies the auto-freeze rule", async () => {
    // Preference 1 is far out of reach; preference 2 opens in a later round; preference 3 is a Round I seat.
    const prefs = [demoChoiceCode("16006", 0), demoChoiceCode("06271", 1), demoChoiceCode("06271", 3)];
    const { status, body } = await post("/api/simulate", { ...candidate, merit: 5500, preferences: prefs });
    expect(status).toBe(200);
    expect(body.rounds.map((r: { round: string }) => r.round)).toEqual(["I", "II", "III", "IV"]);
    expect(body.grid).toHaveLength(3);
    const held = body.rounds.map((r: { preference: number | null }) => r.preference);
    // never moves to a lower preference
    for (let i = 1; i < held.length; i++) if (held[i - 1] && held[i]) expect(held[i]).toBeLessThanOrEqual(held[i - 1]);
    // Round IV is always final
    expect(body.rounds[3].frozen).toBe(true);
    expect(body.assumptions).toMatch(/rehearsal/);
  });

  it("freezes a first-choice seat in Round I", async () => {
    const prefs = [demoChoiceCode("06007", 3), demoChoiceCode("06271", 0)];
    const { body } = await post("/api/simulate", { ...candidate, merit: 1, preferences: prefs });
    expect(body.rounds[0]).toMatchObject({ preference: 1, frozen: true });
    expect(body.rounds[1].frozenEarlier).toBe(true);
  });

  it("reports unknown choice codes without failing", async () => {
    const { status, body } = await post("/api/simulate", { ...candidate, preferences: ["0000000000"] });
    expect(status).toBe(200);
    expect(body.grid[0].known).toBe(false);
    expect(body.rounds.every((r: { preference: number | null }) => r.preference === null)).toBe(true);
  });
});

describe("JEE estimate (#8)", () => {
  it("reads the All India merit list when it is loaded", async () => {
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        expect(sql).toContain("list = 'PCMAI'");
        expect(params[0]).toBe(97.5);
        return { rows: [{ total: "60000", above: "1480", below: "1521" }] };
      },
    } as unknown as pg.Pool;
    const res = await createApp(demoCache(), pool).request("http://localhost/api/jee-estimate?percentile=97.5");
    const body = (await res.json()) as Record<string, any>;
    expect(body).toMatchObject({ method: "data", kind: "all-india-merit", rankRange: [1481, 1520], totalCandidates: 60000 });
  });

  it("falls back to a labelled JEE rank when the list is missing", async () => {
    const res = await app.request("http://localhost/api/jee-estimate?percentile=97.5");
    const body = (await res.json()) as Record<string, any>;
    expect(body).toMatchObject({ method: "statistical", kind: "jee-rank" });
    expect(body.disclaimer).toMatch(/not your All India merit number/);
  });
});

describe("fees (#42)", () => {
  it("resolves fee entries to 5-digit college codes and marks unverified amounts", async () => {
    const res = await app.request("http://localhost/api/colleges/16006/fees");
    const body = (await res.json()) as Record<string, any>;
    expect(body).toMatchObject({ available: true, code: "16006", verified: false });
    expect(body.disclaimer).toMatch(/Not yet checked/);
  });

  it("never serves fees under a legacy 4-digit key", async () => {
    const res = await app.request("http://localhost/api/colleges/6299/fees");
    expect(((await res.json()) as Record<string, any>).available).toBe(false);
  });

  it("reports entries it cannot match instead of guessing", async () => {
    const { buildFeeIndex } = await import("../src/feeIndex.ts");
    const idx = buildFeeIndex(demoCache(), {
      a: { name: "COEP Technological University", tuitionFee: 1, developmentFee: 0, otherFees: 0, totalAnnualFee: 1, tfwsAvailable: false, tfwsSeats: null, fraOrderRef: null, fraOrderUrl: "https://example/fra", sampleOnly: false },
      b: { name: "Some Unknown College", tuitionFee: 1, developmentFee: 0, otherFees: 0, totalAnnualFee: 1, tfwsAvailable: false, tfwsSeats: null, fraOrderRef: null, fraOrderUrl: null, sampleOnly: false },
    });
    expect([...idx.byCollege.keys()]).toEqual(["16006"]);
    expect(idx.unmatched).toEqual(["Some Unknown College"]);
    expect(idx.verified).toBe(1);
  });
});

describe("colleges and meta (#114, #115)", () => {
  it("filters colleges by district and type and lists the values", async () => {
    const res = await app.request("http://localhost/api/colleges?district=Pune");
    const body = (await res.json()) as Record<string, any>;
    expect(body.colleges.length).toBe(3);
    expect(body.districts).toContain("Mumbai City");
    const gov = (await (await app.request("http://localhost/api/colleges?type=Government")).json()) as Record<string, any>;
    expect(gov.colleges.every((c: { collegeType: string }) => c.collegeType === "Government")).toBe(true);
  });

  it("returns the source file and page with every cutoff", async () => {
    const body = (await (await app.request("http://localhost/api/colleges/16006/cutoffs")).json()) as Record<string, any>;
    expect(body.college.district).toBe("Pune");
    expect(body.cutoffs.every((r: { source: string; sourcePage: number }) => r.source && r.sourcePage)).toBe(true);
  });

  it("describes the loaded data", async () => {
    const body = (await (await app.request("http://localhost/api/meta")).json()) as Record<string, any>;
    expect(body).toMatchObject({ year: 2026, colleges: 6, branches: 24 });
    expect(body.lists.map((l: { list: string; round: string }) => `${l.list}-${l.round}`)).toContain("MH-IV");
    expect(body.fees.colleges).toBe(4);
  });
});
