import pg from "pg";

/**
 * Creates a read-only pool.
 * Local dev: reads DATABASE_URL_STAGING from .env
 * Railway / production: reads DATABASE_URL injected by the platform
 */
export function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_STAGING;
  if (!url) throw new Error("DATABASE_URL or DATABASE_URL_STAGING must be set");
  return new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 5 });
}
