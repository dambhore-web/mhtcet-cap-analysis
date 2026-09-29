// Load NIRF placement figures into the `placement` table (STAGING only), replacing all NIRF rows in
// one transaction. Source: packages/pipeline/data/college-placement.json (built by `npm run placement`).
// Rows for colleges not in the current CAP list are skipped and reported.
// Usage: npm run load:placement [-- --dry-run]
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { connectStaging, upsert } from "../db.ts";
import { REPO_ROOT } from "../paths.ts";

const AUTHORITY = "NIRF";
const PROGRAM = "UG4";
/** The first build covered ~140 colleges; far fewer rows means a broken build. */
const MIN_ROWS = 300;
const dryRun = process.argv.includes("--dry-run");

interface Row {
  graduationYear: string;
  graduates: number;
  placed: number | null;
  medianSalary: number | null;
  higherStudies: number | null;
  nirfYear: number;
  nirfCategory: string;
  nirfInstituteId: string;
  sourceUrl: string;
}
const file = JSON.parse(await readFile(join(REPO_ROOT, "packages/pipeline/data/college-placement.json"), "utf8")) as {
  colleges: Record<string, { rows: Row[] }>;
};
const currentCodes = new Set(Object.keys(JSON.parse(await readFile(join(REPO_ROOT, "packages/pipeline/data/college-meta-2026.json"), "utf8"))));

const skipped = Object.keys(file.colleges).filter((code) => !currentCodes.has(code));
const rows = Object.entries(file.colleges)
  .filter(([code]) => currentCodes.has(code))
  .flatMap(([code, c]) => c.rows.map((r) => ({ code, ...r })));
const colleges = new Set(rows.map((r) => r.code)).size;
console.log(`[LOAD-PLACEMENT] ${rows.length} rows for ${colleges} of ${currentCodes.size} current colleges`);
for (const code of skipped) console.log(`${process.env.GITHUB_ACTIONS ? "::warning::" : ""}[LOAD-PLACEMENT] skipped ${code}: not a current college`);
if (rows.length < MIN_ROWS) throw new Error(`[LOAD-PLACEMENT] only ${rows.length} rows; refusing to replace the placement table`);
if (dryRun) process.exit(0);

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const gitCommit = (() => { try { return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim(); } catch { return null; } })();
const client = await connectStaging();
try {
  await client.query("insert into ingest_run (id, kind, year, git_commit, started_at, status) values ($1, 'load-placement', 2026, $2, now(), 'running')", [runId, gitCommit]);
  await client.query("begin");
  const removed = (await client.query("delete from placement where authority = $1", [AUTHORITY])).rowCount ?? 0;
  const inserted = await upsert(client, "placement",
    ["authority", "college_code", "program", "graduation_year", "graduates", "placed", "median_salary", "higher_studies",
      "nirf_year", "nirf_category", "nirf_institute_id", "source_url", "run_id", "updated_at"],
    ["authority", "college_code", "program", "graduation_year"],
    rows.map((r) => [AUTHORITY, r.code, PROGRAM, r.graduationYear, r.graduates, r.placed, r.medianSalary, r.higherStudies,
      r.nirfYear, r.nirfCategory, r.nirfInstituteId, r.sourceUrl, runId, new Date()]));
  await client.query("commit");
  const summary = { rows: rows.length, colleges, removed, inserted, skipped };
  await client.query("update ingest_run set finished_at = now(), status = 'succeeded', summary = $2 where id = $1", [runId, JSON.stringify(summary)]);
  console.log(`[LOAD-PLACEMENT] staging run ${runId}: replaced ${removed} rows with ${inserted}`);
} catch (err) {
  await client.query("rollback").catch(() => undefined);
  await client.query("update ingest_run set finished_at = now(), status = 'failed' where id = $1", [runId]).catch(() => undefined);
  throw err;
} finally {
  await client.end();
}
