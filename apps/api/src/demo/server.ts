import { serve } from "@hono/node-server";
import type pg from "pg";
import { createApp } from "../app.ts";
import { demoCache } from "./demoCache.ts";
import { demoAssistant } from "./demoAssistant.ts";

/**
 * Serves the real API over the invented demo dataset, with no database.
 * Used by the Playwright suite and for local work without a `.env`.
 */
const PORT = parseInt(process.env.PORT ?? "3001", 10);

/**
 * A pool stand-in. It answers the All India merit-list query from an invented curve
 * (60,000 JEE candidates) and returns no rows for everything else.
 */
const demoPool = {
  query: async (sql: string, params: unknown[] = []) => {
    if (sql.includes("list = 'PCMAI'")) {
      const p = Number(params[0]);
      const at = Math.max(1, Math.round(60000 * (1 - p / 100)));
      return { rows: [{ total: "60000", above: String(Math.max(0, at - 6)), below: String(at + 6) }] };
    }
    return { rows: [] };
  },
} as unknown as pg.Pool;

serve({ fetch: createApp(demoCache(), demoPool, { assistantClient: demoAssistant }).fetch, port: PORT }, () => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event: "startup", mode: "demo", port: PORT }));
});
