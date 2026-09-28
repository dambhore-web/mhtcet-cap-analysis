// Load one year's parsed seat matrix into seat_matrix (STAGING only), replacing that year's rows.
// Usage: npm run load:seatmatrix -- <year>
// Needs data/processed/<year>/seat_matrix.ndjson and seat_matrix-check.json (npm run
// parse:seatmatrix -- <year>). Refuses to load unless every blocking check passed and the rows
// still match what was checked (count, positive seats, unique natural keys).
import { execSync } from "node:child_process";
import { join } from "node:path";
import { connectStaging, upsert } from "../db.ts";
import { readJson, readNdjson, writeJson } from "../io.ts";
import type { SeatMatrixRow } from "../parse/seatMatrix.ts";
import { processedDir, REPO_ROOT, REPORTS_DIR } from "../paths.ts";
import { findPersonalData, type CheckResult } from "../validate/report.ts";

const AUTHORITY = "MH-CET-CELL";
const EXAM = "MHT-CET";
/** Every year has well over 1,000 branches; fewer means a broken parse. */
const MIN_BRANCHES = 1000;

const year = Number(process.argv[2]);
if (!/^\d{4}$/.test(process.argv[2] ?? "")) throw new Error("usage: load:seatmatrix <year>");
const dir = processedDir(year);
const rows = await readNdjson<SeatMatrixRow>(join(dir, "seat_matrix.ndjson"));
const check = await readJson<{ rows: number; branches: number; colleges: number; checks: CheckResult[] }>(join(dir, "seat_matrix-check.json"));

const keys = new Set(rows.map((r) => `${r.choiceCode}|${r.seatType}`));
const failed = check.checks.filter((c) => c.blocking && !c.pass).map((c) => c.name);
const problems = [
  failed.length > 0 && `blocking checks failed: ${failed.join(", ")}`,
  rows.length !== check.rows && `ndjson has ${rows.length} rows but the check saw ${check.rows} (re-run parse:seatmatrix)`,
  check.branches < MIN_BRANCHES && `only ${check.branches} branches`,
  rows.some((r) => r.year !== year || r.authority !== AUTHORITY || r.exam !== EXAM) && "rows for another year/authority/exam",
  rows.some((r) => !Number.isInteger(r.seats) || r.seats <= 0) && "rows with seats <= 0",
  keys.size !== rows.length && `${rows.length - keys.size} duplicate (choice code, seat type) keys`,
  findPersonalData(JSON.stringify(rows)) && "personal data pattern found",
].filter(Boolean);
if (problems.length) throw new Error(`[LOAD-SM] ${year} blocked: ${problems.join("; ")}`);

const byPool: Record<string, number> = {};
for (const r of rows) byPool[r.pool] = (byPool[r.pool] ?? 0) + r.seats;
console.log(`[LOAD-SM] ${year}: ${rows.length} rows, ${check.branches} branches, ${check.colleges} colleges, seats by pool ${JSON.stringify(byPool)}`);

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const gitCommit = (() => { try { return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim(); } catch { return null; } })();
const client = await connectStaging();
try {
  await client.query("insert into ingest_run (id, kind, year, git_commit, started_at, status) values ($1, 'load-seat-matrix', $2, $3, now(), 'running')", [runId, year, gitCommit]);
  await client.query("begin");
  const removed = (await client.query("delete from seat_matrix where authority = $1 and exam = $2 and year = $3", [AUTHORITY, EXAM, year])).rowCount ?? 0;
  const inserted = await upsert(client, "seat_matrix",
    ["authority", "exam", "year", "choice_code", "college_code", "seat_type", "pool", "seats", "source", "source_page", "run_id", "updated_at"],
    ["authority", "exam", "year", "choice_code", "seat_type"],
    rows.map((r) => [AUTHORITY, EXAM, year, r.choiceCode, r.collegeCode, r.seatType, r.pool, r.seats, r.sourceFile, r.sourcePage, runId, new Date()]),
    2000);
  await client.query("commit");
  const summary = { rows: rows.length, branches: check.branches, colleges: check.colleges, seatsByPool: byPool, removed, inserted };
  await client.query("update ingest_run set finished_at = now(), status = 'succeeded', summary = $2 where id = $1", [runId, JSON.stringify(summary)]);
  await writeJson(join(REPORTS_DIR, `load-seat-matrix-${runId}.json`), { kind: "load-seat-matrix", environment: "staging", runId, gitCommit, year, ...summary });
  console.log(`[LOAD-SM] staging run ${runId}: replaced ${removed} rows with ${inserted}`);
} catch (err) {
  await client.query("rollback").catch(() => undefined);
  await client.query("update ingest_run set finished_at = now(), status = 'failed' where id = $1", [runId]).catch(() => undefined);
  throw err;
} finally {
  await client.end();
}
