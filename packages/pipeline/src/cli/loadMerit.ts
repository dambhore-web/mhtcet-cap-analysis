// Load one parsed merit list into merit_lookup (STAGING only), replacing that list for the year.
// Usage: npm run load:merit -- <year> <PCMMH|PCMAI>
// Refuses to load unless the list passes its checks: merit numbers 1..N with no gaps or duplicates,
// no score increases within an exam, and at least MIN_ROWS rows. Only merit, exam and score are
// stored; nothing that looks like an application ID reaches the database.
import { execSync } from "node:child_process";
import { join } from "node:path";
import type { AuthorityId, MeritRow } from "@mhtcet/core";
import { connectStaging, upsert } from "../db.ts";
import { readNdjson, writeJson } from "../io.ts";
import { checkMeritList } from "../parse/merit.ts";
import { processedDir, REPO_ROOT, REPORTS_DIR } from "../paths.ts";
import { findPersonalData } from "../validate/report.ts";

const AUTHORITY: AuthorityId = "MH-CET-CELL";
const FILES: Record<string, string> = { PCMAI: "ai_merit.ndjson", PCMMH: "mh_merit.ndjson" };
/** A final PCM list has well over 100,000 candidates; fewer means a broken parse. */
const MIN_ROWS = 100_000;

const year = Number(process.argv[2]);
const list = (process.argv[3] ?? "").toUpperCase();
if (!year || !FILES[list]) throw new Error("usage: load:merit <year> <PCMMH|PCMAI>");

const rows = await readNdjson<MeritRow>(join(processedDir(year), FILES[list]));
const c = checkMeritList(rows);
const problems = [
  rows.length < MIN_ROWS && `only ${rows.length} rows`,
  c.minMerit !== 1 && `merit starts at ${c.minMerit}`,
  c.gaps.length > 0 && `${c.gaps.length} gaps in merit numbers (first ${c.gaps.slice(0, 5).join(", ")})`,
  c.duplicates > 0 && `${c.duplicates} duplicate merit numbers`,
  c.monotoneViolations.length > 0 && `${c.monotoneViolations.length} score increases within an exam`,
  findPersonalData(JSON.stringify(rows.slice(0, 1000))) && "personal data pattern found",
].filter(Boolean);
if (problems.length) throw new Error(`[LOAD-MERIT] ${list} ${year} blocked: ${problems.join("; ")}`);

const byExam: Record<string, number> = {};
for (const r of rows) byExam[r.exam] = (byExam[r.exam] ?? 0) + 1;
console.log(`[LOAD-MERIT] ${list} ${year}: ${rows.length} rows, merit 1-${c.maxMerit}, by exam ${JSON.stringify(byExam)}`);

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const gitCommit = (() => { try { return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim(); } catch { return null; } })();
const client = await connectStaging();
try {
  await client.query("insert into ingest_run (id, kind, year, git_commit, started_at, status) values ($1, 'load-merit', $2, $3, now(), 'running')", [runId, year, gitCommit]);
  await client.query("begin");
  const removed = (await client.query("delete from merit_lookup where authority = $1 and year = $2 and list = $3", [AUTHORITY, year, list])).rowCount ?? 0;
  const inserted = await upsert(client, "merit_lookup",
    ["authority", "year", "list", "merit", "exam", "score", "run_id"], ["authority", "year", "list", "merit"],
    rows.map((r) => [AUTHORITY, year, list, r.merit, r.exam, r.score, runId]),
    5000);
  await client.query("commit");
  const summary = { list, rows: rows.length, maxMerit: c.maxMerit, byExam, removed, inserted };
  await client.query("update ingest_run set finished_at = now(), status = 'succeeded', summary = $2 where id = $1", [runId, JSON.stringify(summary)]);
  await writeJson(join(REPORTS_DIR, `load-merit-${runId}.json`), { kind: "load-merit", environment: "staging", runId, gitCommit, year, ...summary });
  console.log(`[LOAD-MERIT] staging run ${runId}: replaced ${removed} rows with ${inserted}`);
} catch (err) {
  await client.query("rollback").catch(() => undefined);
  await client.query("update ingest_run set finished_at = now(), status = 'failed' where id = $1", [runId]).catch(() => undefined);
  throw err;
} finally {
  await client.end();
}
