import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "crypto";
import { health } from "./routes/health.ts";
import { getColleges, getCollegeCutoffs } from "./routes/colleges.ts";
import { postRankFinder } from "./routes/rankFinder.ts";
import { getMeritEstimate } from "./routes/meritEstimate.ts";
import { getCollegeFees } from "./routes/fees.ts";
import { postSimulate } from "./routes/simulate.ts";
import { getJeeEstimate } from "./routes/jeeEstimate.ts";
import { postAssistant } from "./routes/assistant.ts";
import { getMeta } from "./routes/meta.ts";
import { getBranches, getBranchHistory } from "./routes/branches.ts";
import type { AppCache } from "./startup.ts";
import { buildFeeIndex } from "./feeIndex.ts";
import { compressJson } from "./compress.ts";
import type { ChatClient } from "./assistant/run.ts";
import type pg from "pg";

export interface AppOptions {
  /** Replaces the Groq client (demo mode and tests); no API key needed when set. */
  assistantClient?: ChatClient;
}

export function createApp(cache: AppCache, pool: pg.Pool, options: AppOptions = {}) {
  const app = new Hono();
  const fees = buildFeeIndex(cache, cache.fees);

  app.use("*", cors({ origin: "*" }));

  app.use("*", async (c, next) => {
    const reqId = (c.req.header("x-request-id") ?? randomUUID()).slice(0, 36);
    c.res.headers.set("x-request-id", reqId);
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    const log = {
      ts: new Date().toISOString(),
      reqId,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      ms,
    };
    console.log(JSON.stringify(log));
  });

  app.use("/api/*", compressJson);

  app.get("/api/health", health);
  app.get("/api/meta", (c) => getMeta(c, cache, pool, fees));
  app.get("/api/colleges", (c) => getColleges(c, cache));
  app.get("/api/colleges/:code/cutoffs", (c) => getCollegeCutoffs(c, cache));
  app.post("/api/rank-finder", (c) => postRankFinder(c, cache));
  app.post("/api/simulate", (c) => postSimulate(c, cache));
  app.get("/api/merit-estimate", (c) => getMeritEstimate(c, pool));
  app.get("/api/jee-estimate", (c) => getJeeEstimate(c, pool));
  app.get("/api/branches", (c) => getBranches(c, cache));
  app.get("/api/branches/:choiceCode/history", (c) => getBranchHistory(c, cache));
  app.get("/api/colleges/:code/fees", (c) => getCollegeFees(c, fees, cache));
  app.post("/api/assistant", (c) => postAssistant(c, cache, options.assistantClient));

  app.onError((err, c) => {
    const reqId = c.res.headers.get("x-request-id") ?? "?";
    console.error(JSON.stringify({ ts: new Date().toISOString(), reqId, event: "error", message: err.message }));
    return c.json({ error: "internal_error" }, 500);
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
}
