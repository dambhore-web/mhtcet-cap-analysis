// Apply pending SQL migrations (packages/pipeline/migrations/NNN_*.sql) to the STAGING database.
// Usage: npm run migrate
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectStaging } from "../db.ts";

const dir = fileURLToPath(new URL("../../migrations", import.meta.url));
const client = await connectStaging();
try {
  await client.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const applied = new Set((await client.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  for (const f of files) {
    if (applied.has(f)) {
      console.log(`[MIGRATE] already applied ${f}`);
      continue;
    }
    const sql = await readFile(join(dir, f), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [f]);
      await client.query("commit");
      console.log(`[MIGRATE] applied ${f}`);
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
} finally {
  await client.end();
}
