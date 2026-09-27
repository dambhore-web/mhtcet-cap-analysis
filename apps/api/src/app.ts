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
import type { AppCache } from "./startup.ts";
import type pg from "pg";

export function createApp(cache: AppCache, pool: pg.Pool) {
  const app = new Hono();

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

  app.get("/api/health", health);
  app.get("/api/colleges", (c) => getColleges(c, cache));
  app.get("/api/colleges/:code/cutoffs", (c) => getCollegeCutoffs(c, cache));
  app.post("/api/rank-finder", (c) => postRankFinder(c, cache));
  app.post("/api/simulate", (c) => postSimulate(c, cache));
  app.get("/api/merit-estimate", (c) => getMeritEstimate(c, pool));
  app.get("/api/jee-estimate", getJeeEstimate);
  app.get("/api/colleges/:code/fees", getCollegeFees);
  app.post("/api/assistant", postAssistant);

  app.onError((err, c) => {
    const reqId = c.res.headers.get("x-request-id") ?? "?";
    console.error(JSON.stringify({ ts: new Date().toISOString(), reqId, event: "error", message: err.message }));
    return c.json({ error: "internal_error" }, 500);
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
}
