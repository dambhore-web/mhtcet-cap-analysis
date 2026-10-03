// Load college fees into the `fee` table (STAGING only), replacing all fee rows in one transaction.
// Sources: apps/api/src/data/fees.json (built from the FRA reports by `npm run fees`) and, when
// present, packages/pipeline/data/fees-manual.csv (fees collected from colleges' own fee notices,
// each with a source URL). Rows with a problem are skipped and reported.
// Usage: npm run load:fees [-- --dry-run]
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { connectStaging, upsert } from "../db.ts";
import { mergeAndCheck, rowsFromFraFile, rowsFromManualCsv, type FeeProblem } from "../fees/feeRows.ts";
import { REPO_ROOT } from "../paths.ts";

const AUTHORITY = "MH-CET-CELL";
/** fees.json covers ~320 colleges; far fewer means a broken build. */
const MIN_ROWS = 300;
const dryRun = process.argv.includes("--dry-run");

const fraFile = JSON.parse(await readFile(join(REPO_ROOT, "apps/api/src/data/fees.json"), "utf8")) as Record<string, unknown>;
const manualPath = join(REPO_ROOT, "packages/pipeline/data/fees-manual.csv");
const currentCodes = new Set(Object.keys(JSON.parse(await readFile(join(REPO_ROOT, "packages/pipeline/data/college-meta-2026.json"), "utf8"))));

const problems: FeeProblem[] = [];
const fra = rowsFromFraFile(fraFile);
const manual = existsSync(manualPath) ? rowsFromManualCsv(await readFile(manualPath, "utf8"), problems) : [];
const rows = mergeAndCheck(fra, manual, currentCodes, problems);

const bySource = { FRA: rows.filter((r) => r.source === "FRA").length, college: rows.filter((r) => r.source === "college").length };
const colleges = new Set(rows.map((r) => r.collegeCode)).size;
console.log(`[LOAD-FEES] ${rows.length} rows (FRA ${bySource.FRA}, college notices ${bySource.college}) for ${colleges} of ${currentCodes.size} current colleges`);
for (const p of problems) console.log(`${process.env.GITHUB_ACTIONS ? "::warning::" : ""}[LOAD-FEES] skipped ${p.collegeCode}: ${p.problem}`);
if (rows.length < MIN_ROWS) throw new Error(`[LOAD-FEES] only ${rows.length} rows; refusing to replace the fee table`);
if (dryRun) process.exit(0);

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const gitCommit = (() => { try { return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim(); } catch { return null; } })();
const client = await connectStaging();
try {
  await client.query("insert into ingest_run (id, kind, year, git_commit, started_at, status) values ($1, 'load-fees', 2026, $2, now(), 'running')", [runId, gitCommit]);
  await client.query("begin");
  const removed = (await client.query("delete from fee where authority = $1", [AUTHORITY])).rowCount ?? 0;
  const inserted = await upsert(client, "fee",
    ["authority", "college_code", "academic_year", "tuition_fee", "development_fee", "other_fees", "total_fee", "source", "source_url",
      "fra_institute_id", "fra_status", "fra_meeting_date", "tfws_available", "notes", "run_id", "updated_at"],
    ["authority", "college_code", "academic_year"],
    rows.map((r) => [AUTHORITY, r.collegeCode, r.academicYear, r.tuitionFee, r.developmentFee, r.otherFees, r.totalFee, r.source, r.sourceUrl,
      r.fraInstituteId, r.fraStatus, r.fraMeetingDate, r.tfwsAvailable, r.notes, runId, new Date()]));
  await client.query("commit");
  const summary = { rows: rows.length, colleges, bySource, removed, inserted, skipped: problems };
  await client.query("update ingest_run set finished_at = now(), status = 'succeeded', summary = $2 where id = $1", [runId, JSON.stringify(summary)]);
  console.log(`[LOAD-FEES] staging run ${runId}: replaced ${removed} rows with ${inserted}`);
} catch (err) {
  await client.query("rollback").catch(() => undefined);
  await client.query("update ingest_run set finished_at = now(), status = 'failed' where id = $1", [runId]).catch(() => undefined);
  throw err;
} finally {
  await client.end();
}
