import { serve } from "@hono/node-server";
import { createPool } from "./db.ts";
import { loadCache } from "./startup.ts";
import { createApp } from "./app.ts";
import { securityWarnings } from "./securityChecks.ts";

const CACHE_YEAR = 2026;
const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function main() {
  for (const warning of securityWarnings()) console.warn(JSON.stringify({ ts: new Date().toISOString(), event: "security_warning", warning }));
  const pool = createPool();
  const cache = await loadCache(pool, CACHE_YEAR);

  const app = createApp(cache, pool);

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: "startup", port: PORT, year: CACHE_YEAR }));
  });
}

main().catch((err) => {
  console.error("[startup]", err);
  process.exit(1);
});
