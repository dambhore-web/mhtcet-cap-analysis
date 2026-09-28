// Load validated data into the STAGING database (idempotent upserts).
// Usage: npm run load -- [year]
// Refuses to run unless data/processed/<year>/validation.json allows the load and is newer than
// the processed files. Excluded files, colleges and keys from the validation report are skipped.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { AuthorityId, CutoffRow, MeritRow } from "@mhtcet/core";
import { connectStaging, upsert } from "../db.ts";
import { readJson, readNdjson, writeJson } from "../io.ts";
import { processedDir, REPO_ROOT, REPORTS_DIR } from "../paths.ts";
import type { MhBranch, MhCollege } from "../parse/cutoffMh.ts";
import type { InstituteListRow } from "../parse/instituteList.ts";
import { cutoffKey, findPersonalData, type RunReport } from "../validate/report.ts";

const AUTHORITY: AuthorityId = "MH-CET-CELL";
const EXAM = "MHT-CET";
const year = Number(process.argv[2] ?? 2026);
const dir = processedDir(year);

const validation = await readJson<RunReport>(join(dir, "validation.json"));
if (!validation.load.allowed) throw new Error(`[LOAD] validation blocks the load: ${validation.load.blockedBy.join(", ")}`);
const vTime = (await stat(join(dir, "validation.json"))).mtimeMs;
const filesToCheck = ["cutoffs.ndjson", "institutes.json", "cutoff-colleges.json"];
if (validation.load.merit.allowed) filesToCheck.push("ai_merit.ndjson");
for (const f of filesToCheck) {
  if ((await stat(join(dir, f))).mtimeMs > vTime) throw new Error(`[LOAD] ${f} changed after validation; run validate again`);
}

const rawInstitutes = await readJson<InstituteListRow[]>(join(dir, "institutes.json"));
// Merge district + collegeType from college-meta-<year>.json if present (FR-008 / #115).
// File lives in packages/pipeline/data/ so it's tracked in git.
const collegeMetaPath = join(REPO_ROOT, "packages/pipeline/data", `college-meta-${year}.json`);
const collegeMeta = await readJson<Record<string, { district: string | null; collegeType: string | null }>>(
  collegeMetaPath,
).catch(() => ({} as Record<string, { district: string | null; collegeType: string | null }>));
const { colleges: mhColleges, branches } = await readJson<{ colleges: MhCollege[]; branches: MhBranch[] }>(join(dir, "cutoff-colleges.json"));
const institutesByCode = new Map(rawInstitutes.map((i) => [i.code, i]));
// For historical years the institute list may be a proxy from a different year; supplement it
// with any colleges found in the MH cutoff PDFs so branch FK constraints are satisfied.
for (const c of mhColleges) {
  if (!institutesByCode.has(c.code)) {
    institutesByCode.set(c.code, { code: c.code, name: c.name, status: "", totalIntake: null });
  }
}
const institutes = [...institutesByCode.values()].map((i) => ({
  ...i,
  district: collegeMeta[i.code]?.district ?? null,
  collegeType: collegeMeta[i.code]?.collegeType ?? null,
}));
const excluded = validation.load.cutoffs;
const excludedKeys = new Set(excluded.excludedKeys);
const allCutoffs = await readNdjson<CutoffRow>(join(dir, "cutoffs.ndjson"));
const cutoffs = allCutoffs.filter(
  (c) => !excluded.excludedFiles.includes(c.sourceFile) && !excluded.excludedColleges.includes(c.collegeCode) && !excludedKeys.has(cutoffKey(c)),
);
const merit = validation.load.merit.allowed ? await readNdjson<MeritRow>(join(dir, "ai_merit.ndjson")) : [];
const mhMeritPath = join(dir, "mh_merit.ndjson");
const mhMerit = existsSync(mhMeritPath) ? await readNdjson<MeritRow>(mhMeritPath) : [];

// Last line of defence: nothing that looks like an application ID goes to the database.
if (findPersonalData(JSON.stringify([institutes, mhColleges, branches])) || cutoffs.some((c) => findPersonalData(JSON.stringify(c)))) {
  throw new Error("[LOAD] personal data pattern found; nothing loaded");
}

// Home university per college: the most common value on its branches' Status lines.
// "Autonomous Institute" is a CET Cell labelling artefact for newly-autonomous branches at
// otherwise-affiliated colleges — exclude it so the real affiliating university wins the vote.
// Genuinely autonomous colleges (all branches tagged this way) correctly get null.
const homeUni = new Map<string, string>();
for (const code of new Set(branches.map((b) => b.collegeCode))) {
  const counts = new Map<string, number>();
  for (const b of branches.filter((x) => x.collegeCode === code && x.homeUniversity && x.homeUniversity !== "Autonomous Institute"))
    counts.set(b.homeUniversity!, (counts.get(b.homeUniversity!) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (top) homeUni.set(code, top[0]);
}

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const gitCommit = (() => { try { return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim(); } catch { return null; } })();
const client = await connectStaging();
const counts: Record<string, number> = {};
try {
  await client.query("insert into ingest_run (id, kind, year, git_commit, started_at, status) values ($1, 'load', $2, $3, now(), 'running')", [runId, year, gitCommit]);

  counts.collegeUpserts = await upsert(client, "college",
    ["authority", "code", "exam", "name", "status", "home_university", "total_intake", "district", "college_type", "run_id", "updated_at"], ["authority", "code"],
    institutes.map((i) => [AUTHORITY, i.code, EXAM, i.name, i.status, homeUni.get(i.code) ?? null, i.totalIntake, i.district ?? null, i.collegeType ?? null, runId, new Date()]));

  counts.branchUpserts = await upsert(client, "branch",
    ["authority", "choice_code", "college_code", "exam", "name", "status", "run_id", "updated_at"], ["authority", "choice_code"],
    branches.map((b) => [AUTHORITY, b.choiceCode, b.collegeCode, EXAM, b.name, b.status, runId, new Date()]));

  counts.cutoffUpserts = await upsert(client, "cutoff",
    ["authority", "exam", "year", "list", "round", "choice_code", "section", "seat_type", "stage", "college_code", "closing_merit", "closing_percentile", "source", "source_page", "run_id", "updated_at"],
    ["authority", "exam", "year", "list", "round", "choice_code", "section", "seat_type", "stage"],
    cutoffs.map((c) => [c.authority, c.exam, c.year, c.list, c.round, c.choiceCode, c.section, c.seatType, c.stage, c.collegeCode, c.closingMerit, c.closingPercentile, c.sourceFile, c.sourcePage, runId, new Date()]),
    1000);

  counts.meritUpserts = await upsert(client, "merit_lookup",
    ["authority", "year", "list", "merit", "exam", "score", "run_id"], ["authority", "year", "list", "merit"],
    merit.map((m) => [AUTHORITY, year, "PCMAI", m.merit, m.exam, m.score, runId]),
    5000);

  counts.mhMeritUpserts = mhMerit.length > 0 ? await upsert(client, "merit_lookup",
    ["authority", "year", "list", "merit", "exam", "score", "run_id"], ["authority", "year", "list", "merit"],
    mhMerit.map((m) => [AUTHORITY, year, "PCMMH", m.merit, m.exam, m.score, runId]),
    5000) : 0;

  const q = async (sql: string, p: unknown[] = []): Promise<number> => Number((await client.query<{ n: string }>(sql, p)).rows[0].n);
  const tables = {
    college: await q("select count(*) n from college where authority = $1", [AUTHORITY]),
    branch: await q("select count(*) n from branch where authority = $1", [AUTHORITY]),
    cutoff: await q("select count(*) n from cutoff where authority = $1 and year = $2", [AUTHORITY, year]),
    merit_lookup: await q("select count(*) n from merit_lookup where authority = $1 and year = $2", [AUTHORITY, year]),
  };
  const summary = {
    validationReport: validation.createdAt, excluded, sourceCutoffRows: allCutoffs.length, loadedCutoffRows: cutoffs.length, meritRows: merit.length, counts, tables,
  };
  await client.query("update ingest_run set finished_at = now(), status = 'succeeded', summary = $2 where id = $1", [runId, JSON.stringify(summary)]);
  await writeJson(join(REPORTS_DIR, `load-${runId}.json`), { kind: "load", environment: "staging", runId, gitCommit, year, ...summary });
  console.log(`[LOAD] staging run ${runId}: ${JSON.stringify(tables)}`);
} catch (err) {
  await client.query("update ingest_run set finished_at = now(), status = 'failed' where id = $1", [runId]).catch(() => undefined);
  throw err;
} finally {
  await client.end();
}
