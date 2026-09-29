import { describe, it, expect, beforeAll } from "vitest";
import type { Hono } from "hono";
import { createApp } from "../src/app.ts";
import { seedCache, stubPool } from "./fixtures.ts";

let app: Hono;

beforeAll(() => {
  app = createApp(seedCache(), stubPool);
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function get(path: string) {
  const res = await app.request(`http://localhost${path}`);
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

async function post(path: string, body: unknown) {
  const res = await app.request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

// ─── Health ───────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const { status, body } = await get("/api/health");
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "ok" });
  });
});

// ─── Colleges ─────────────────────────────────────────────────────────────────

describe("GET /api/colleges", () => {
  it("returns all colleges sorted by name", async () => {
    const { status, body } = await get("/api/colleges");
    expect(status).toBe(200);
    const colleges = body.colleges as { code: string; name: string }[];
    expect(colleges.length).toBe(2);
    expect(colleges[0].name.localeCompare(colleges[1].name, "en")).toBeLessThanOrEqual(0);
  });

  it("skips colleges with no cutoffs in the cache year (earlier-year-only colleges)", async () => {
    const cache = seedCache();
    cache.colleges.set("09999", {
      authority: "MH-CET-CELL", exam: "MHT-CET", code: "09999", name: "Aaa Closed College",
      status: null, homeUniversity: null, totalIntake: null,
    });
    const res = await createApp(cache, stubPool).request("http://localhost/api/colleges");
    const body = (await res.json()) as { colleges: { code: string }[] };
    expect(body.colleges.map((c) => c.code)).not.toContain("09999");
    expect(body.colleges).toHaveLength(2);
  });

  it("filters by query string", async () => {
    const { status, body } = await get("/api/colleges?q=jijabai");
    expect(status).toBe(200);
    const colleges = body.colleges as { code: string }[];
    expect(colleges.length).toBe(1);
    expect(colleges[0].code).toBe("1002");
  });

  it("filters by university", async () => {
    const { status, body } = await get("/api/colleges?university=Savitribai+Phule+Pune+University");
    expect(status).toBe(200);
    const colleges = body.colleges as { code: string }[];
    expect(colleges.every((c) => c.code === "5002")).toBe(true);
  });

  it("returns total alongside count", async () => {
    const { body } = await get("/api/colleges");
    expect(typeof body.total).toBe("number");
    expect(body.total).toBe(body.count);
  });
});

// ─── College cutoffs ──────────────────────────────────────────────────────────

describe("GET /api/colleges/:code/cutoffs", () => {
  it("returns cutoffs for a known college", async () => {
    const { status, body } = await get("/api/colleges/1002/cutoffs");
    expect(status).toBe(200);
    expect(body.college).toMatchObject({ code: "1002" });
    const cutoffs = body.cutoffs as object[];
    expect(cutoffs.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown college code", async () => {
    const { status } = await get("/api/colleges/9999/cutoffs");
    expect(status).toBe(404);
  });
});

// ─── Rank finder ──────────────────────────────────────────────────────────────

describe("POST /api/rank-finder", () => {
  const base = {
    merit: 100,
    homeUniversity: "University of Mumbai",
    category: null,
    gender: "M",
    minorityCommunity: null,
    flags: { ews: false, tfws: false, defence: false, pwd: false, orphan: false },
    subjectGroup: "PCM",
  };

  it("finds VJTI for a merit within Round I closing", async () => {
    const { status, body } = await post("/api/rank-finder", { ...base, merit: 100 });
    expect(status).toBe(200);
    const options = body.options as { collegeCode: string; status: string }[];
    const vjti = options.find((o) => o.collegeCode === "1002");
    expect(vjti).toBeDefined();
    expect(vjti?.status).toBe("round-I");
  });

  it("returns later-round for merit between Round I and Round II closing", async () => {
    const { status, body } = await post("/api/rank-finder", { ...base, merit: 160 });
    expect(status).toBe(200);
    const options = body.options as { collegeCode: string; status: string }[];
    const vjti = options.find((o) => o.collegeCode === "1002");
    expect(vjti).toBeDefined();
    expect(vjti?.status).toBe("later-round");
  });

  it("returns out-of-range for merit beyond all round closings", async () => {
    const { status, body } = await post("/api/rank-finder", { ...base, merit: 99999 });
    expect(status).toBe(200);
    const options = body.options as { collegeCode: string; status: string }[];
    const vjti = options.find((o) => o.collegeCode === "1002");
    expect(vjti?.status).toBe("out-of-range");
  });

  it("returns 400 for missing merit", async () => {
    const { status } = await post("/api/rank-finder", { ...base, merit: undefined });
    expect(status).toBe(400);
  });

  it("rejects wrong year", async () => {
    const { status } = await post("/api/rank-finder", { ...base, year: 2025 });
    expect(status).toBe(404);
  });
});

// ─── Simulator ────────────────────────────────────────────────────────────────

describe("POST /api/simulate", () => {
  const base = {
    merit: 100,
    homeUniversity: "University of Mumbai",
    category: null,
    gender: "M",
    minorityCommunity: null,
    flags: { ews: false, tfws: false, defence: false, pwd: false, orphan: false },
    subjectGroup: "PCM",
    preferences: ["1002119110", "5002119110"],
  };

  it("returns allotment at first preference for low merit", async () => {
    const { status, body } = await post("/api/simulate", base);
    expect(status).toBe(200);
    const allotments = body.allotments as { round: string; choiceCode: string }[];
    const r1 = allotments.find((a) => a.round === "I");
    expect(r1?.choiceCode).toBe("1002119110");
  });

  it("returns empty allotments for merit above all closings", async () => {
    const { status, body } = await post("/api/simulate", { ...base, merit: 999999 });
    expect(status).toBe(200);
    expect((body.allotments as unknown[]).length).toBe(0);
  });

  it("returns 400 when preferences is empty", async () => {
    const { status } = await post("/api/simulate", { ...base, preferences: [] });
    expect(status).toBe(400);
  });
});

// ─── Merit estimate ───────────────────────────────────────────────────────────

describe("GET /api/merit-estimate", () => {
  it("returns statistical fallback when no DB", async () => {
    const { status, body } = await get("/api/merit-estimate?percentile=90&subjectGroup=PCM");
    expect(status).toBe(200);
    expect(body.method).toBe("statistical");
    const [lo, hi] = body.estimatedMeritRange as [number, number];
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(lo);
  });

  it("reads only the state merit list, never MHT-CET rows from the All India list", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return { rows: [{ cnt: "0", min_merit: null, max_merit: null }] };
      },
    } as never;
    const res = await createApp(seedCache(), pool).request(
      "http://localhost/api/merit-estimate?percentile=90&subjectGroup=PCM",
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/list = \$3/);
    expect(calls[0].params).toEqual([90, 2026, "PCMMH", "MHT-CET-PCM"]);
    // No state list loaded yet → honest statistical fallback
    expect(body.method).toBe("statistical");
  });

  it("returns 400 when percentile is missing", async () => {
    const { status } = await get("/api/merit-estimate?subjectGroup=PCM");
    expect(status).toBe(400);
  });

  it("returns 400 for out-of-range percentile", async () => {
    const { status } = await get("/api/merit-estimate?percentile=110");
    expect(status).toBe(400);
  });
});

// ─── JEE estimate ─────────────────────────────────────────────────────────────

describe("GET /api/jee-estimate", () => {
  it("returns estimated rank for a valid percentile", async () => {
    const { status, body } = await get("/api/jee-estimate?percentile=95");
    expect(status).toBe(200);
    expect(typeof body.estimatedRank).toBe("number");
    expect(body.estimatedRank).toBeGreaterThan(0);
    const [lo, hi] = body.rankRange as [number, number];
    expect(lo).toBeLessThan(hi);
  });

  it("returns rank 1 for 100th percentile", async () => {
    const { status, body } = await get("/api/jee-estimate?percentile=100");
    expect(status).toBe(200);
    expect(body.estimatedRank).toBe(1);
  });

  it("returns 400 when percentile is missing", async () => {
    const { status } = await get("/api/jee-estimate");
    expect(status).toBe(400);
  });
});

// ─── Request ID ───────────────────────────────────────────────────────────────

describe("x-request-id header", () => {
  it("echoes a provided request ID back", async () => {
    const res = await app.request("http://localhost/api/health", {
      headers: { "x-request-id": "my-trace-123" },
    });
    expect(res.headers.get("x-request-id")).toBe("my-trace-123");
  });

  it("generates a request ID when none provided", async () => {
    const res = await app.request("http://localhost/api/health");
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

describe("not found", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const { status, body } = await get("/api/nope");
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "not_found" });
  });
});

// ─── Fees from the fee table ─────────────────────────────────────────────────

describe("GET /api/colleges/:code/fees with fees loaded from the database", () => {
  it("uses the cache's fee rows instead of fees.json, with null parts and the source", async () => {
    const cache = seedCache();
    cache.fees = {
      "1002": {
        name: "VJTI", collegeCode: "1002", tuitionFee: null, developmentFee: null, otherFees: null, totalAnnualFee: 21000,
        tfwsAvailable: false, tfwsSeats: null, fraOrderRef: null, fraOrderUrl: null, sampleOnly: false,
        academicYear: "2026-27", source: "college", sourceUrl: "https://example.org/fees.pdf",
      },
    };
    const res = await createApp(cache, stubPool).request("http://localhost/api/colleges/1002/fees");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      available: true, year: "2026-27", source: "college", sourceUrl: "https://example.org/fees.pdf",
      fees: { tuitionFee: null, developmentFee: null, otherFees: null, totalAnnualFee: 21000 },
    });
    const other = await createApp(cache, stubPool).request("http://localhost/api/colleges/5002/fees");
    expect(((await other.json()) as { available: boolean }).available).toBe(false);
  });
});

// ─── Placement (NIRF) ────────────────────────────────────────────────────────

describe("GET /api/colleges/:code/placement", () => {
  it("returns each graduating batch with rates, and available: false without data", async () => {
    const cache = seedCache();
    cache.placement = new Map([["1002", [
      { graduationYear: "2023-24", graduates: 400, placed: 300, medianSalary: 650000, higherStudies: 20, nirfYear: 2025, nirfCategory: "Engineering", sourceUrl: "https://example.org/nirf-2025.pdf" },
      { graduationYear: "2024-25", graduates: 410, placed: null, medianSalary: null, higherStudies: 0, nirfYear: 2026, nirfCategory: "Overall", sourceUrl: "https://example.org/nirf-2026.pdf" },
    ]]]);
    const res = await createApp(cache, stubPool).request("http://localhost/api/colleges/1002/placement");
    const body = (await res.json()) as { available: boolean; batches: Array<Record<string, unknown>> };
    expect(body.available).toBe(true);
    expect(body.batches[0]).toMatchObject({ graduationYear: "2023-24", placedPct: 75, higherStudiesPct: 5, medianSalary: 650000, nirfYear: 2025 });
    expect(body.batches[1]).toMatchObject({ graduationYear: "2024-25", placed: null, placedPct: null, higherStudiesPct: 0 });
    const other = await createApp(cache, stubPool).request("http://localhost/api/colleges/5002/placement");
    expect(await other.json()).toEqual({ available: false, code: "5002" });
  });

  it("is unavailable when the placement table was not loaded", async () => {
    const res = await createApp(seedCache(), stubPool).request("http://localhost/api/colleges/1002/placement");
    expect(((await res.json()) as { available: boolean }).available).toBe(false);
  });
});

// ─── Branch history (year-on-year) ───────────────────────────────────────────

describe("GET /api/branches/:choiceCode/history", () => {
  it("merges earlier years from the history cache with the cache year's state rows", async () => {
    const cache = seedCache();
    cache.history.set("1002119110", [
      { year: 2024, round: "I", seatType: "GOPENS", section: "State Level", stage: "I", closingMerit: 180, closingPercentile: null },
      { year: 2025, round: "I", seatType: "GOPENS", section: "State Level", stage: "I", closingMerit: 165, closingPercentile: null },
    ]);
    const res = await createApp(cache, stubPool).request("http://localhost/api/branches/1002119110/history");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { years: number[]; collegeCode: string; rows: { year: number; round: string; closingMerit: number }[] };
    expect(body.collegeCode).toBe("1002");
    expect(body.years).toEqual([2024, 2025, 2026]);
    expect(body.rows.filter((r) => r.round === "I").map((r) => [r.year, r.closingMerit])).toEqual([[2024, 180], [2025, 165], [2026, 150]]);
  });

  it("returns 404 for an unknown choice code", async () => {
    const { status } = await get("/api/branches/9999999999/history");
    expect(status).toBe(404);
  });
});

// ─── Rank finder: earlier years on each option ───────────────────────────────

describe("POST /api/rank-finder pastYears", () => {
  it("adds last-round closing ranks of earlier years for the same seat type", async () => {
    const cache = seedCache();
    cache.history.set("1002119110", [
      { year: 2024, round: "I", seatType: "GOPENH", section: "Home University", stage: "I", closingMerit: 140, closingPercentile: null },
      { year: 2024, round: "III", seatType: "GOPENH", section: "Home University", stage: "I", closingMerit: 190, closingPercentile: null },
      { year: 2024, round: "II", seatType: "GOPENH", section: "Home University", stage: "I", closingMerit: 170, closingPercentile: null },
      { year: 2025, round: "I", seatType: "GOPENH", section: "Home University", stage: "I", closingMerit: 145, closingPercentile: null },
      { year: 2025, round: "I", seatType: "LOPENH", section: "Home University", stage: "I", closingMerit: 999, closingPercentile: null },
    ]);
    const res = await createApp(cache, stubPool).request("http://localhost/api/rank-finder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026, merit: 100, candidature: "MH", homeUniversity: "University of Mumbai", category: "OPEN", gender: "M", subjectGroup: "PCM" }),
    });
    const body = (await res.json()) as { options: { choiceCode: string; seatType: string; pastYears: unknown[] }[] };
    const vjti = body.options.find((o) => o.choiceCode === "1002119110")!;
    expect(vjti.seatType).toBe("GOPENH");
    expect(vjti.pastYears).toEqual([
      { year: 2024, lastRoundClosing: 190 },
      { year: 2025, lastRoundClosing: 145 },
    ]);
  });
});

// ─── Seat matrix: seats on options and TFWS on fees ──────────────────────────

describe("seat matrix in the API", () => {
  const withSeats = () => {
    const cache = seedCache();
    cache.seats.set("1002119110", new Map([["GOPENH", 2], ["GOBCH", 5], ["AI", 9], ["TFWS", 3], ["EWS", 6]]));
    return cache;
  };

  it("adds the option's seat-type count and the branch intake (without EWS/TFWS)", async () => {
    const res = await createApp(withSeats(), stubPool).request("http://localhost/api/rank-finder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026, merit: 100, candidature: "MH", homeUniversity: "University of Mumbai", category: "OPEN", gender: "M", subjectGroup: "PCM" }),
    });
    const body = (await res.json()) as { options: { choiceCode: string; seats: unknown }[] };
    expect(body.options.find((o) => o.choiceCode === "1002119110")!.seats).toEqual({ seatType: 2, branch: 16 });
  });

  it("gives TFWS seats and branches on the fee card from the seat matrix", async () => {
    const cache = withSeats();
    cache.fees = {
      "1002": {
        name: "VJTI", collegeCode: "1002", tuitionFee: 80000, developmentFee: 5000, otherFees: 0, totalAnnualFee: 85000,
        tfwsAvailable: false, tfwsSeats: null, fraOrderRef: null, fraOrderUrl: null, sampleOnly: false, academicYear: "2026-27",
      },
    };
    const res = await createApp(cache, stubPool).request("http://localhost/api/colleges/1002/fees");
    expect(await res.json()).toMatchObject({ available: true, tfwsAvailable: true, tfwsSeats: 3, tfwsBranches: 1 });
  });

  it("returns null seats when the seat matrix has no row", async () => {
    const res = await createApp(seedCache(), stubPool).request("http://localhost/api/rank-finder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026, merit: 100, candidature: "MH", homeUniversity: "University of Mumbai", category: "OPEN", gender: "M", subjectGroup: "PCM" }),
    });
    const body = (await res.json()) as { options: { seats: unknown }[] };
    expect(body.options[0].seats).toEqual({ seatType: null, branch: null });
  });
});
