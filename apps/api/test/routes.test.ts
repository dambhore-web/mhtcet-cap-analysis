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
