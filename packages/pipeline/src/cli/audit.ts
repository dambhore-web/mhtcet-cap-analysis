// Data audit: what is loaded in staging, and which expected datasets are missing.
// Read-only. Prints aggregate counts only (no candidate data) as markdown, and appends the same
// report to the GitHub Actions job summary when GITHUB_STEP_SUMMARY is set.
// Usage: npm run data:audit -w @mhtcet/pipeline
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { connectStaging } from "../db.ts";
import { REPO_ROOT } from "../paths.ts";

/** Years the product shows (BR-005: 2026 plus three earlier years). */
const YEARS = [2023, 2024, 2025, 2026];
/**
 * Official cutoff lists published per year: MH and AI for each CAP round, Diploma for the last one.
 * 2023 and 2024 had three CAP rounds (Diploma list in Round III); 2025 and 2026 had four.
 */
const ROUNDS: Record<number, string[]> = { 2023: ["I", "II", "III"], 2024: ["I", "II", "III"] };
const expectedLists = (year: number): Array<[list: string, round: string]> => {
  const rounds = ROUNDS[year] ?? ["I", "II", "III", "IV"];
  return [
    ...rounds.map((r): [string, string] => ["MH", r]),
    ...rounds.map((r): [string, string] => ["AI", r]),
    ["Diploma", rounds[rounds.length - 1]],
  ];
};
/** Merit lists the estimators read: state merit (FE<year>_PCMMH, #10) and All India (FE<year>_PCMAI). */
const EXPECTED_MERIT: Array<[list: string, use: string]> = [
  ["PCMMH", "MHT-CET percentile → state merit (#10)"],
  ["PCMAI", "JEE percentile → All India merit"],
];
/** Tables the planned features need that the schema does not have yet. */
const PLANNED_TABLES: Array<[table: string, need: string]> = [
  ["seat_matrix", "seats per branch and seat type (#40)"],
  ["allotment", "per-college allotment lists (#11, #40 seats left)"],
  ["fee", "fees in the DB instead of fees.json (#42)"],
];

const out: string[] = [];
const line = (s = ""): void => { out.push(s); };
const table = (head: string[], rows: unknown[][]): void => {
  line(`| ${head.join(" | ")} |`);
  line(`|${head.map(() => "---").join("|")}|`);
  for (const r of rows) line(`| ${r.map((v) => (v === null || v === undefined ? "–" : String(v))).join(" | ")} |`);
  line();
};
const n = (v: unknown): number => Number(v ?? 0);

const client = await connectStaging();
try {
  const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
    (await client.query(sql, params)).rows as T[];

  line("# Data audit (staging)");
  line();
  line(`Run at ${new Date().toISOString()}. Counts only; no candidate data.`);
  line();

  // 1. Tables present
  const present = new Set(
    (await rows<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    )).map((r) => r.table_name),
  );
  line("## Tables");
  const counts: unknown[][] = [];
  for (const t of ["college", "branch", "cutoff", "merit_lookup", "ingest_run"]) {
    counts.push([t, present.has(t) ? n((await rows(`select count(*) c from ${t}`))[0].c) : "MISSING"]);
  }
  for (const [t, need] of PLANNED_TABLES) counts.push([t, present.has(t) ? "present" : `not created — ${need}`]);
  table(["table", "rows"], counts);

  // 2. Cutoff lists by year / list / round
  const cut = await rows<{ year: number; list: string; round: string; rows: string; colleges: string; branches: string }>(
    `select year, list, round, count(*) rows, count(distinct college_code) colleges, count(distinct choice_code) branches
       from cutoff group by year, list, round`,
  );
  const cutKey = new Map(cut.map((r) => [`${r.year}|${r.list}|${r.round}`, r]));
  line("## Cutoff lists (expected: MH + AI per CAP round, Diploma in the last round, for 2023–2026)");
  const cutRows: unknown[][] = [];
  let missingLists = 0;
  for (const y of YEARS) {
    for (const [list, round] of expectedLists(y)) {
      const r = cutKey.get(`${y}|${list}|${round}`);
      if (!r) missingLists++;
      cutRows.push([y, list, round, r ? n(r.rows) : "MISSING", r ? n(r.colleges) : "–", r ? n(r.branches) : "–"]);
    }
  }
  for (const r of cut) {
    if (!YEARS.includes(r.year) || !expectedLists(r.year).some(([l, ro]) => l === r.list && ro === r.round)) {
      cutRows.push([r.year, r.list, r.round, `${n(r.rows)} (unexpected)`, n(r.colleges), n(r.branches)]);
    }
  }
  table(["year", "list", "round", "rows", "colleges", "branches"], cutRows);
  line(`Missing cutoff lists: **${missingLists} of ${YEARS.reduce((t, y) => t + expectedLists(y).length, 0)}**.`);
  line();

  // 3. Merit lookup lists
  const merit = await rows<{ year: number; list: string; exam: string; rows: string; lo: string; hi: string }>(
    `select year, list, exam, count(*) rows, min(score) lo, max(score) hi from merit_lookup group by year, list, exam order by 1, 2, 3`,
  );
  line("## Merit lists (merit_lookup)");
  const meritRows: unknown[][] = [];
  const shown = new Set<string>();
  for (const y of YEARS) {
    for (const [list, use] of EXPECTED_MERIT) {
      const found = merit.filter((m) => m.year === y && m.list === list);
      if (!found.length) meritRows.push([y, list, "–", "MISSING", "–", use]);
      for (const r of found) {
        shown.add(`${r.year}|${r.list}|${r.exam}`);
        meritRows.push([y, list, r.exam, n(r.rows), `${r.lo}–${r.hi}`, use]);
      }
    }
  }
  for (const r of merit) {
    if (!shown.has(`${r.year}|${r.list}|${r.exam}`)) meritRows.push([r.year, r.list, r.exam, n(r.rows), `${r.lo}–${r.hi}`, "other"]);
  }
  table(["year", "list", "exam", "rows", "score range", "used for"], meritRows);

  // 4. College field gaps
  const cols = new Set(
    (await rows<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'college'",
    )).map((r) => r.column_name),
  );
  line("## College fields (387 expected)");
  const fieldRows: unknown[][] = [];
  for (const f of ["status", "home_university", "total_intake", "district", "college_type"]) {
    if (!cols.has(f)) { fieldRows.push([f, "column missing (migration not applied)", "–"]); continue; }
    const r = (await rows<{ filled: string; empty: string }>(
      `select count(${f}) filled, count(*) - count(${f}) empty from college`,
    ))[0];
    fieldRows.push([f, n(r.filled), n(r.empty)]);
  }
  table(["field", "filled", "empty"], fieldRows);

  // 5. Coverage gaps in the latest year
  const latest = n((await rows<{ y: number }>("select max(year) y from cutoff"))[0]?.y);
  line(`## Coverage gaps (${latest})`);
  const noCutoff = await rows<{ code: string; name: string }>(
    `select c.code, c.name from college c
      where not exists (select 1 from cutoff k where k.college_code = c.code and k.year = $1) order by c.code`,
    [latest],
  );
  const noRoundIMh = n((await rows<{ c: string }>(
    `select count(*) c from college c
      where not exists (select 1 from cutoff k where k.college_code = c.code and k.year = $1 and k.list = 'MH' and k.round = 'I')`,
    [latest],
  ))[0].c);
  const branchNoCutoff = n((await rows<{ c: string }>(
    `select count(*) c from branch b
      where not exists (select 1 from cutoff k where k.choice_code = b.choice_code and k.year = $1)`,
    [latest],
  ))[0].c);
  table(["check", "count"], [
    ["colleges with no cutoff rows at all", noCutoff.length],
    ["colleges with no MH Round I cutoffs", noRoundIMh],
    ["branches with no cutoff rows", branchNoCutoff],
  ]);
  if (noCutoff.length) {
    line("Colleges with no cutoff rows:");
    for (const c of noCutoff.slice(0, 50)) line(`- ${c.code} ${c.name}`);
    if (noCutoff.length > 50) line(`- … and ${noCutoff.length - 50} more`);
    line();
  }

  // 6. Fees (apps/api/src/data/fees.json, not in the DB)
  const fees = JSON.parse(await readFile(join(REPO_ROOT, "apps/api/src/data/fees.json"), "utf8")) as Record<
    string, { tfwsAvailable?: boolean; tfwsSeats?: number | null; fraOrderRef?: string | null }
  >;
  const feeCodes = Object.keys(fees).filter((k) => !k.startsWith("_"));
  const allCodes = (await rows<{ code: string }>("select code from college")).map((r) => r.code);
  const noFee = allCodes.filter((c) => !fees[c]);
  line("## Fees (fees.json)");
  table(["check", "count"], [
    ["colleges with a fee entry", `${allCodes.length - noFee.length} of ${allCodes.length}`],
    ["colleges without a fee entry", noFee.length],
    ["entries marking TFWS available", feeCodes.filter((c) => fees[c].tfwsAvailable).length],
    ["entries with TFWS seat counts", feeCodes.filter((c) => fees[c].tfwsSeats != null).length],
    ["entries with an FRA order reference", feeCodes.filter((c) => fees[c].fraOrderRef).length],
  ]);

  // 7. Ingest runs
  line("## Ingest runs");
  table(["run", "kind", "year", "status", "commit"],
    (await rows<{ id: string; kind: string; year: number; status: string; git_commit: string }>(
      "select id, kind, year, status, git_commit from ingest_run order by id",
    )).map((r) => [r.id, r.kind, r.year, r.status, r.git_commit]));
} finally {
  await client.end();
}

const report = out.join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
