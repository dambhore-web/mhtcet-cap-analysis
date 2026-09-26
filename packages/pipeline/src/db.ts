import pg from "pg";

/**
 * Connect to the STAGING database only. The connection string comes from DATABASE_URL_STAGING
 * (loaded from the git-ignored .env); it is never printed or logged. Production loads are a
 * separate, operator-approved step and are deliberately not supported here.
 */
export async function connectStaging(): Promise<pg.Client> {
  const url = process.env.DATABASE_URL_STAGING;
  console.log(`[DB] DATABASE_URL_STAGING set: ${Boolean(url)}`);
  if (!url) throw new Error("[DB] DATABASE_URL_STAGING is not set; build and validate only");
  // Supabase pooler presents a certificate chain Node does not trust by default.
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

/** Multi-row INSERT ... ON CONFLICT DO UPDATE for one batch. */
export async function upsert(
  client: pg.Client,
  table: string,
  columns: string[],
  conflict: string[],
  rows: unknown[][],
  batchSize = 1000,
): Promise<number> {
  const update = columns.filter((c) => !conflict.includes(c)).map((c) => `${c} = excluded.${c}`);
  let n = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const params: unknown[] = [];
    const values = batch.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(", ")})`);
    const sql =
      `insert into ${table} (${columns.join(", ")}) values ${values.join(", ")} ` +
      `on conflict (${conflict.join(", ")}) do ${update.length ? `update set ${update.join(", ")}` : "nothing"}`;
    const res = await client.query(sql, params);
    n += res.rowCount ?? 0;
  }
  return n;
}
