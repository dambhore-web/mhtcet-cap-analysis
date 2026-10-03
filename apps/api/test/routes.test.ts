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

  it("filters by several branch groups (any one matches) and ignores unknown groups", async () => {
    const codes = async (branchGroups: string[]) => {
      const { status, body } = await post("/api/rank-finder", { ...base, filters: { branchGroups } });
      expect(status).toBe(200);
      return (body.options as { collegeCode: string }[]).map((o) => o.collegeCode);
    };
    expect(await codes(["Civil", "Computer & IT"])).toContain("1002");
    expect(await codes(["Civil", "Mechanical"])).toEqual([]);
    expect(await codes(["Not a group"])).toContain("1002");
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

  it("returns the college's own website figures, alone or with NIRF", async () => {
    const cache = seedCache();
    cache.placementClaims = new Map([["5002", {
      year: "2024-25", highest: 1_200_000, average: 450_000, median: null, placedPct: 85, crawledAt: "2026-09-29",
      claims: [{ metric: "highest", value: 1_200_000, year: "2024-25", snippet: "Highest package 12 LPA", sourceUrl: "https://example.org/placements" }],
    }]]);
    const res = await createApp(cache, stubPool).request("http://localhost/api/colleges/5002/placement");
    const body = (await res.json()) as { available: boolean; batches: unknown[]; collegeClaims: Record<string, unknown> };
    expect(body.available).toBe(true);
    expect(body.batches).toEqual([]);
    expect(body.collegeClaims).toMatchObject({ year: "2024-25", highest: 1_200_000, average: 450_000, placedPct: 85, sources: ["https://example.org/placements"] });
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

// ─── Every branch's open closing rank (landing page ruler) ───────────────────

describe("GET /api/cutoffs/open-latest", () => {
  const base = { authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH", collegeCode: "1002", section: "State Level", seatType: "GOPENS", stage: "I", closingPercentile: null, sourceFile: "test", sourcePage: 1 } as const;
  type Row = [string, string, string, number | null, number, string | null, string];

  it("uses each branch's GOPENS Round I and latest-round closing rank when the branch has state-level seats", async () => {
    const cache = seedCache();
    cache.cutoffsByChoiceCode.set("1002119110", [
      ...(cache.cutoffsByChoiceCode.get("1002119110") ?? []),
      { ...base, choiceCode: "1002119110", round: "III", closingMerit: 120 },
      { ...base, choiceCode: "1002119110", round: "I", closingMerit: 99 },
    ]);
    const res = await createApp(cache, stubPool).request("http://localhost/api/cutoffs/open-latest");
    expect(res.status).toBe(200);
    const b = (await res.json()) as { year: number; seatTypes: string[]; rows: Row[] };
    expect(b.seatTypes).toEqual(["GOPENS", "GOPENO", "GOPENH", "LOPENS", "LOPENO", "LOPENH"]);
    // the branch also has home-university rows, but its state-level seat wins
    expect(b.rows.find((r) => r[0] === "1002119110")).toEqual(["1002119110", "1002", "Computer Engineering", 99, 120, "Computer & IT", "GOPENS"]);
  });

  it("falls back to GOPENO, then GOPENH, for colleges without state-level open seats", async () => {
    const cache = seedCache();
    const b = (await (await createApp(cache, stubPool).request("http://localhost/api/cutoffs/open-latest")).json()) as { rows: Row[] };
    // the fixture has only home-university open seats: the college is no longer dropped
    expect(b.rows.length).toBeGreaterThan(0);
    expect(b.rows.every((r) => r[6] === "GOPENO" || r[6] === "GOPENH")).toBe(true);
    const hOnly = b.rows.find((r) => r[6] === "GOPENH");
    expect(hOnly).toBeDefined();
    const code = hOnly![0];
    cache.cutoffsByChoiceCode.set(code, [
      ...(cache.cutoffsByChoiceCode.get(code) ?? []),
      { ...base, choiceCode: code, section: "Other Than Home University", seatType: "GOPENO", round: "I", closingMerit: 77 },
    ]);
    const again = (await (await createApp(cache, stubPool).request("http://localhost/api/cutoffs/open-latest")).json()) as { rows: Row[] };
    const row = again.rows.find((r) => r[0] === code)!;
    expect(row[6]).toBe("GOPENO");
    expect(row[4]).toBe(77);
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
      { year: 2024, lastRoundClosing: 190, lastRoundPercentile: null },
      { year: 2025, lastRoundClosing: 145, lastRoundPercentile: null },
    ]);
  });
});

// ─── Searching by percentile (before the merit list is out) ─────────────────

describe("POST /api/rank-finder by percentile", () => {
  const withPercentiles = () => {
    const cache = seedCache();
    const pct: Record<number, number> = { 150: 99.95, 175: 99.93, 8500: 96.2, 9200: 95.9 };
    for (const rows of cache.cutoffsByChoiceCode.values()) for (const r of rows) r.closingPercentile = pct[r.closingMerit];
    return cache;
  };
  const ask = (cache: ReturnType<typeof seedCache>, body: object) =>
    createApp(cache, stubPool).request("http://localhost/api/rank-finder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeUniversity: "University of Mumbai", gender: "M", subjectGroup: "PCM", ...body }),
    });
  type Opt = { collegeCode: string; status: string; round: string; closingMerit: number; closingPercentile: number | null;
    firstRoundPercentile: number | null; lastRoundPercentile: number | null; rounds: { closingPercentile: number | null }[] };

  it("matches a percentile against each row's closing percentile", async () => {
    const res = await ask(withPercentiles(), { percentile: 96 });
    expect(res.status).toBe(200);
    const { options } = (await res.json()) as { options: Opt[] };
    const pune = options.find((o) => o.collegeCode === "5002")!;
    expect(pune).toMatchObject({ status: "later-round", round: "II", closingMerit: 9200, closingPercentile: 95.9 });
    expect(pune).toMatchObject({ firstRoundPercentile: 96.2, lastRoundPercentile: 95.9 });
    expect(options.find((o) => o.collegeCode === "1002")!.status).toBe("out-of-range");
  });

  it("gives both figures on every option when searching by merit number too", async () => {
    const { options } = (await (await ask(withPercentiles(), { merit: 100 })).json()) as { options: Opt[] };
    const vjti = options.find((o) => o.collegeCode === "1002")!;
    expect(vjti).toMatchObject({ status: "round-I", closingMerit: 150, closingPercentile: 99.95 });
    expect(vjti.rounds.map((r) => r.closingPercentile)).toEqual([99.95, 99.93]);
  });

  it("needs a merit number or a percentile", async () => {
    expect((await ask(seedCache(), {})).status).toBe(400);
    expect((await ask(seedCache(), { percentile: 101 })).status).toBe(400);
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

// ─── Sitemap (SEO) ──────────────────────────────────────────────────────────

describe("GET /api/sitemap", () => {
  it("lists colleges with cutoffs and the choice codes of their branches with cutoffs", async () => {
    const cache = seedCache();
    const res = await createApp(cache, stubPool).request("http://localhost/api/sitemap");
    expect(res.status).toBe(200);
    const b = (await res.json()) as { year: number; colleges: { code: string; branches: string[] }[] };
    expect(b.year).toBe(cache.year);
    expect(b.colleges.length).toBeGreaterThan(0);
    for (const col of b.colleges) {
      expect(cache.colleges.has(col.code)).toBe(true);
      for (const cc of col.branches) {
        expect(cache.branches.get(cc)?.collegeCode).toBe(col.code);
        expect(cache.cutoffsByChoiceCode.get(cc)?.length).toBeGreaterThan(0);
      }
    }
  });

  it("leaves out branches without cutoffs", async () => {
    const cache = seedCache();
    const [cc] = [...cache.cutoffsByChoiceCode.keys()];
    cache.cutoffsByChoiceCode.set(cc, []);
    const b = (await (await createApp(cache, stubPool).request("http://localhost/api/sitemap")).json()) as { colleges: { branches: string[] }[] };
    expect(b.colleges.flatMap((c) => c.branches)).not.toContain(cc);
  });
});

// ─── Fees: official basis and why a college has none (#42) ───────────────────

describe("GET /api/colleges/:code/fees: basis and missing fees (#42)", () => {
  const fraEntry = {
    name: "Test Unaided", collegeCode: "1002", tuitionFee: 100000, developmentFee: 15000, otherFees: 0, totalAnnualFee: 115000,
    tfwsAvailable: false, tfwsSeats: null, fraOrderRef: null, fraOrderUrl: null, sampleOnly: false, academicYear: "2026-27",
    source: "FRA", sourceUrl: "https://ay26-27.mahafraportal.org/report?institute=EN1002", fraStatus: "No Upward Revision",
  };

  it("treats a fee from the FRA's approved-fee report as official, with its status and year", async () => {
    const cache = seedCache();
    cache.fees = { "1002": fraEntry };
    const body = (await (await createApp(cache, stubPool).request("http://localhost/api/colleges/1002/fees")).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ available: true, verified: true, basis: "fra-report", fraStatus: "No Upward Revision", year: "2026-27" });
    expect(body.disclaimer).toBe("From the Fee Regulating Authority's approved-fee report for 2026-27. Confirm with the college before paying.");
  });

  it("says a government college's fees are set by the state, not the FRA", async () => {
    const cache = seedCache();
    cache.fees = {};
    const code = [...cache.colleges.keys()][0];
    cache.colleges.set(code, { ...cache.colleges.get(code)!, collegeType: "Government" });
    const body = (await (await createApp(cache, stubPool).request(`http://localhost/api/colleges/${code}/fees`)).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ available: false, code, collegeType: "Government", reason: "state-set" });
  });

  it("says a private college is not on the FRA report, and still gives TFWS seats", async () => {
    const cache = seedCache();
    cache.seats.set("1002119110", new Map([["TFWS", 3]]));
    cache.fees = {};
    cache.colleges.set("1002", { ...cache.colleges.get("1002")!, collegeType: "Unaided" });
    const body = (await (await createApp(cache, stubPool).request("http://localhost/api/colleges/1002/fees")).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ available: false, reason: "not-on-fra-report", tfwsSeats: 3, tfwsBranches: 1 });
  });
});

// ─── SEO pages (build-time HTML per public URL) ─────────────────────────────

describe("GET /api/seo-pages", () => {
  it("gives each college with its branches' open-seat closing and years, matching open-latest", async () => {
    const cache = seedCache();
    const app = createApp(cache, stubPool);
    const pages = (await (await app.request("http://localhost/api/seo-pages")).json()) as {
      year: number;
      colleges: { code: string; name: string; branches: { choiceCode: string; name: string; roundI: number | null; latest: number; seatType: string; years: number[] }[] }[];
    };
    const open = (await (await app.request("http://localhost/api/cutoffs/open-latest")).json()) as { rows: [string, string, string, number | null, number, string | null, string][] };
    expect(pages.year).toBe(cache.year);
    const branches = pages.colleges.flatMap((c) => c.branches.map((b) => [b.choiceCode, c.code, b.name, b.roundI, b.latest, b.seatType]));
    expect(branches.length).toBe(open.rows.length);
    for (const r of open.rows) expect(branches).toContainEqual([r[0], r[1], r[2], r[3], r[4], r[6]]);
    for (const c of pages.colleges) {
      expect(c.name).toBe(cache.colleges.get(c.code)!.name);
      for (const b of c.branches) expect(b.years).toContain(cache.year);
    }
  });
});

// ─── District landing pages (SEO) ────────────────────────────────────────────

describe("GET /api/districts and /api/districts/:slug", () => {
  const withDistricts = () => {
    const cache = seedCache();
    for (const c of cache.colleges.values()) c.district = "Pune";
    cache.colleges.get("1002")!.district = "Mumbai-City";
    return cache;
  };

  it("lists each district by slug, with a branch-group page only when 2+ colleges qualify", async () => {
    const cache = withDistricts();
    let b = (await (await createApp(cache, stubPool).request("http://localhost/api/districts")).json()) as {
      districts: { slug: string; name: string; colleges: number; groups: { slug: string }[] }[];
    };
    expect(b.districts.map((d) => d.slug)).toEqual(["mumbai-city", "pune"]);
    expect(b.districts.every((d) => d.groups.length === 0)).toBe(true);

    cache.colleges.get("1002")!.district = "Pune";
    b = (await (await createApp(cache, stubPool).request("http://localhost/api/districts")).json()) as typeof b;
    expect(b.districts).toHaveLength(1);
    expect(b.districts[0]).toMatchObject({ slug: "pune", name: "Pune", colleges: 2, groups: [{ slug: "computer-it", name: "Computer & IT", colleges: 2 }] });
  });

  it("gives a district's colleges with branches, and fee and placement only from official sources", async () => {
    const cache = withDistricts();
    cache.fees = {
      "5002": { name: "Pune Engineering College", collegeCode: "5002", tuitionFee: 90000, developmentFee: 10000, otherFees: 0, totalAnnualFee: 100000,
        tfwsAvailable: false, tfwsSeats: null, fraOrderRef: null, fraOrderUrl: null, sampleOnly: false, academicYear: "2026-27",
        source: "FRA", sourceUrl: "https://ay26-27.mahafraportal.org/report?institute=EN5002" },
    };
    cache.placement = new Map([["5002", [
      { graduationYear: "2023-24", graduates: 100, placed: 70, medianSalary: 450000, higherStudies: 5, nirfYear: 2025, nirfCategory: "Engineering", sourceUrl: "x" },
      { graduationYear: "2024-25", graduates: 100, placed: 75, medianSalary: 500000, higherStudies: 5, nirfYear: 2026, nirfCategory: "Engineering", sourceUrl: "x" },
    ]]]);
    const res = await createApp(cache, stubPool).request("http://localhost/api/districts/pune");
    expect(res.status).toBe(200);
    const d = (await res.json()) as { name: string; colleges: { code: string; fee: unknown; placement: unknown; branches: { group: string | null; roundI: number | null }[] }[] };
    expect(d.name).toBe("Pune");
    expect(d.colleges).toHaveLength(1);
    expect(d.colleges[0]).toMatchObject({ code: "5002", fee: { total: 100000, year: "2026-27" }, placement: { medianSalary: 500000, graduationYear: "2024-25" } });
    expect(d.colleges[0].branches[0]).toMatchObject({ group: "Computer & IT", roundI: 8500 });

    const mumbai = (await (await createApp(cache, stubPool).request("http://localhost/api/districts/mumbai-city")).json()) as { colleges: { fee: unknown; placement: unknown }[] };
    expect(mumbai.colleges[0]).toMatchObject({ fee: null, placement: null });
  });

  it("answers 404 for an unknown district", async () => {
    const res = await createApp(withDistricts(), stubPool).request("http://localhost/api/districts/atlantis");
    expect(res.status).toBe(404);
  });

  it("adds districts and their group pages to the sitemap data", async () => {
    const b = (await (await createApp(withDistricts(), stubPool).request("http://localhost/api/sitemap")).json()) as { districts: { slug: string; groups: string[] }[] };
    expect(b.districts).toEqual([{ slug: "mumbai-city", groups: [] }, { slug: "pune", groups: [] }]);
  });
});

// ─── Merit number ↔ percentile scale (the Find page's two views) ─────────────

describe("GET /api/percentile-scale", () => {
  it("pairs merit numbers with percentiles from the lists, sorted, percentile never rising", async () => {
    const cache = seedCache();
    const pct: Record<number, number> = { 150: 99.95, 175: 99.93, 8500: 96.2, 9200: 95.9 };
    for (const rows of cache.cutoffsByChoiceCode.values()) for (const r of rows) r.closingPercentile = pct[r.closingMerit];
    // a printing glitch: a worse merit number with a higher percentile is left out
    cache.cutoffsByChoiceCode.get("5002119110")!.push({ ...cache.cutoffsByChoiceCode.get("5002119110")![0], closingMerit: 9300, closingPercentile: 97 });
    const b = (await (await createApp(cache, stubPool).request("http://localhost/api/percentile-scale?list=MH")).json()) as { list: string; points: [number, number][] };
    expect(b.list).toBe("MH");
    expect(b.points).toEqual([[150, 99.95], [175, 99.93], [8500, 96.2], [9200, 95.9]]);
  });

  it("is empty when the lists print no percentiles", async () => {
    const b = (await (await createApp(seedCache(), stubPool).request("http://localhost/api/percentile-scale")).json()) as { points: unknown[] };
    expect(b.points).toEqual([]);
  });
});
