import pg from "pg";

/**
 * Creates the API's database pool, read-only in effect: every session starts with
 * default_transaction_read_only on, so a bug or an injected query cannot write even when the
 * connection string belongs to a user that could (defence in depth; production should also use a
 * SELECT-only database role, see docs/07-security/security-review-2026-09.md).
 * Local dev: reads DATABASE_URL_STAGING from .env
 * Railway / production: reads DATABASE_URL injected by the platform
 */
export function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_STAGING;
  if (!url) throw new Error("DATABASE_URL or DATABASE_URL_STAGING must be set");
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    // Session setting sent at connection start-up (no extra round trip, no race with the first query)
    options: "-c default_transaction_read_only=on",
  });
  watchIdleErrors(pool);
  return pool;
}

/**
 * An idle connection dropped by the network or the database (e.g. ECONNABORTED) makes the pool
 * emit "error"; unhandled, that ends the whole process. Log it instead: the pool discards the
 * broken connection and opens a new one on the next query.
 */
export function watchIdleErrors(pool: pg.Pool): void {
  pool.on("error", (err) => {
    console.error(JSON.stringify({ ts: new Date().toISOString(), event: "db_idle_error", code: (err as NodeJS.ErrnoException).code ?? null, message: err.message }));
  });
}
