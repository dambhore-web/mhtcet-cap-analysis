import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { rateLimit } from "./rateLimit.ts";
import { randomUUID } from "crypto";
import { health } from "./routes/health.ts";
import { getColleges, getCollegeCutoffs } from "./routes/colleges.ts";
import { postRankFinder } from "./routes/rankFinder.ts";
import { getMeritEstimate } from "./routes/meritEstimate.ts";
import { getCollegeFees } from "./routes/fees.ts";
import { getCollegePlacement } from "./routes/placement.ts";
import { postSimulate } from "./routes/simulate.ts";
import { getJeeEstimate } from "./routes/jeeEstimate.ts";
import { postAssistant } from "./routes/assistant.ts";
import { getMeta } from "./routes/meta.ts";
import { getBranches, getBranchHistory, getOpenLatest } from "./routes/branches.ts";
import { getSitemap } from "./routes/sitemap.ts";
import { getSeoPages } from "./routes/seoPages.ts";
import type { AppCache } from "./startup.ts";
import { buildFeeIndex } from "./feeIndex.ts";
import { compressJson } from "./compress.ts";
import type { ChatClient } from "./assistant/run.ts";
import type pg from "pg";

export interface AppOptions {
  /** Replaces the Groq client (demo mode and tests); no API key needed when set. */
  assistantClient?: ChatClient;
}

/**
 * Browser origins allowed to call the API, from CORS_ORIGINS (comma-separated, e.g. the web app's
 * https://… URL). Unset means any origin, which is fine while the API is public and cookie-less
 * (local dev, demo, tests); production must set it before sign-in adds credentials (#15).
 */
export function corsOrigin(value = process.env.CORS_ORIGINS): string | string[] {
  const list = (value ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  return list.length ? list : "*";
}

/** Largest request body accepted: the assistant's history (12 × 2,000 characters) fits well within it. */
export const MAX_BODY_BYTES = 64 * 1024;

export function createApp(cache: AppCache, pool: pg.Pool, options: AppOptions = {}) {
  const app = new Hono();
  const fees = buildFeeIndex(cache, cache.fees);

  app.use("*", cors({ origin: corsOrigin() }));
  // API responses are JSON only: no framing, no MIME sniffing, no referrer, HTTPS pinned (HSTS).
  app.use("*", secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] }, crossOriginResourcePolicy: "cross-origin" }));
  app.use("/api/*", bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: "payload_too_large" }, 413) }));
  // Per-IP budgets: searches are CPU-heavy and return the whole state, so they get a tighter one.
  app.use("/api/rank-finder", rateLimit("search", 60_000, 60));
  app.use("/api/simulate", rateLimit("search", 60_000, 60));
  app.use("/api/*", rateLimit("api", 60_000, 600));

  app.use("*", async (c, next) => {
    // Only a plain token from the client is echoed and logged, never arbitrary text.
    const sent = c.req.header("x-request-id") ?? "";
    const reqId = /^[A-Za-z0-9-]{1,64}$/.test(sent) ? sent : randomUUID();
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
  app.get("/api/cutoffs/open-latest", (c) => getOpenLatest(c, cache));
  app.get("/api/sitemap", (c) => getSitemap(c, cache));
  app.get("/api/seo-pages", (c) => getSeoPages(c, cache));
  app.get("/api/colleges/:code/fees", (c) => getCollegeFees(c, fees, cache));
  app.get("/api/colleges/:code/placement", (c) => getCollegePlacement(c, cache));
  app.post("/api/assistant", (c) => postAssistant(c, cache, options.assistantClient));

  app.onError((err, c) => {
    const reqId = c.res.headers.get("x-request-id") ?? "?";
    console.error(JSON.stringify({ ts: new Date().toISOString(), reqId, event: "error", message: err.message }));
    return c.json({ error: "internal_error" }, 500);
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
}
