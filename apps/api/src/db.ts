import pg from "pg";

/** Read-only pool for the Supabase staging project. Supabase's pooler certificate is self-signed. */
export function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL_STAGING;
  if (!url) throw new Error("DATABASE_URL_STAGING is not set");
  return new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 5 });
}
