import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createPool } from "./db.ts";
import { loadCache, type AppCache } from "./startup.ts";
import { health } from "./routes/health.ts";
import { getColleges, getCollegeCutoffs } from "./routes/colleges.ts";
import { postRankFinder } from "./routes/rankFinder.ts";
import { getMeritEstimate } from "./routes/meritEstimate.ts";
import { getCollegeFees } from "./routes/fees.ts";
import { postSimulate } from "./routes/simulate.ts";
import { getJeeEstimate } from "./routes/jeeEstimate.ts";
import type pg from "pg";

const CACHE_YEAR = 2026;
const PORT = parseInt(process.env.PORT ?? "3001", 10);

function createApp(cache: AppCache, pool: pg.Pool) {
  const app = new Hono();

  app.use("*", cors({ origin: "*" }));

  app.get("/api/health", health);
  app.get("/api/colleges", (c) => getColleges(c, cache));
  app.get("/api/colleges/:code/cutoffs", (c) => getCollegeCutoffs(c, cache));
  app.post("/api/rank-finder", (c) => postRankFinder(c, cache));
  app.post("/api/simulate", (c) => postSimulate(c, cache));
  app.get("/api/merit-estimate", (c) => getMeritEstimate(c, pool));
  app.get("/api/jee-estimate", getJeeEstimate);
  app.get("/api/colleges/:code/fees", getCollegeFees);

  app.onError((err, c) => {
    console.error("[error]", err);
    return c.json({ error: "internal_error" }, 500);
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
}

async function main() {
  const pool = createPool();
  const cache = await loadCache(pool, CACHE_YEAR);
  // pool stays open — used by merit-estimate and future on-demand queries

  const app = createApp(cache, pool);

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[startup]", err);
  process.exit(1);
});
