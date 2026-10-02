import { readFileSync } from "node:fs";
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
  // Verified against DATABASE_CA_CERT when set; see dbSsl.
  const client = new pg.Client({ connectionString: url, ssl: dbSsl() });
  await client.connect();
  return client;
}

/**
 * TLS for the Supabase database (#131 O3). With DATABASE_CA_CERT set (the PEM text, with real or
 * \\n line breaks, or a path to the .crt/.pem file from Supabase → Project Settings → Database → SSL),
 * the server certificate is verified. Without it the connection is still encrypted but not
 * verified, as before: the pooler's chain isn't in Node's default trust store.
 */
export function dbSsl(env: NodeJS.ProcessEnv = process.env): { ca?: string; rejectUnauthorized: boolean } {
  const v = env.DATABASE_CA_CERT?.trim();
  if (!v) return { rejectUnauthorized: false };
  const ca = v.includes("BEGIN CERTIFICATE") ? v.replace(/\\n/g, "\n").trim() : readFileSync(v, "utf8");
  if (!ca.includes("BEGIN CERTIFICATE")) throw new Error("DATABASE_CA_CERT is not a PEM certificate");
  return { ca, rejectUnauthorized: true };
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
