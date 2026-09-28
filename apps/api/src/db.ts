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
  return new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    // Session setting sent at connection start-up (no extra round trip, no race with the first query)
    options: "-c default_transaction_read_only=on",
  });
}
