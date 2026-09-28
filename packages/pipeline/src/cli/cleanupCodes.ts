// Remove staging rows stored under non-normalised codes (4-digit college codes, 9-digit choice codes,
// or a college's pre-university code), and the cutoff rows of the given years so they can be
// reloaded with normalised codes. Run it just before reloading those years.
// Usage: npm run db:cleanup-codes -- 2023 2024 2025
import { connectStaging } from "../db.ts";
import { COLLEGE_CODE_ALIASES } from "../parse/codes.ts";

const years = process.argv.slice(2).map(Number).filter((y) => y >= 2000 && y < 2100);
if (!years.length) throw new Error("usage: db:cleanup-codes <year> [year...]");
const oldCodes = Object.keys(COLLEGE_CODE_ALIASES);

const client = await connectStaging();
try {
  await client.query("begin");
  const n = async (sql: string, params: unknown[]): Promise<number> => (await client.query(sql, params)).rowCount ?? 0;
  const out = {
    cutoffRowsOfReloadedYears: await n("delete from cutoff where year = any($1::int[])", [years]),
    cutoffRowsWithOldCodes: await n(
      "delete from cutoff where college_code !~ '^[0-9]{5}$' or choice_code !~ '^[0-9]{10}' or college_code = any($1::text[])",
      [oldCodes],
    ),
    branches: await n(
      "delete from branch where college_code !~ '^[0-9]{5}$' or choice_code !~ '^[0-9]{10}' or college_code = any($1::text[])",
      [oldCodes],
    ),
    colleges: await n("delete from college where code !~ '^[0-9]{5}$' or code = any($1::text[])", [oldCodes]),
  };
  await client.query("commit");
  console.log(`[CLEANUP] years ${years.join(", ")}: deleted ${JSON.stringify(out)}`);
} catch (err) {
  await client.query("rollback").catch(() => undefined);
  throw err;
} finally {
  await client.end();
}
