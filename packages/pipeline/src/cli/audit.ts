// Data audit: what is loaded in staging, and which expected datasets are missing.
// Read-only. Prints aggregate counts only (no candidate data) as markdown, and appends the same
// report to the GitHub Actions job summary when GITHUB_STEP_SUMMARY is set.
// Usage: npm run data:audit -w @mhtcet/pipeline
import { appendFile } from "node:fs/promises";
import { connectStaging } from "../db.ts";

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
  ["fee", "college fees (#42), loaded by load:fees"],
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
  for (const [t, need] of PLANNED_TABLES) {
    counts.push([t, present.has(t) ? n((await rows(`select count(*) c from ${t}`))[0].c) : `not created — ${need}`]);
  }
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

  // 2b. Seat matrix by year
  if (present.has("seat_matrix")) {
    line("## Seat matrix");
    const sm = await rows<{ year: number; rows: string; branches: string; colleges: string }>(
      "select year, count(*) rows, count(distinct choice_code) branches, count(distinct college_code) colleges from seat_matrix group by year order by year",
    );
    table(["year", "rows", "branches", "colleges"], YEARS.map((y) => {
      const r = sm.find((x) => x.year === y);
      return [y, r ? n(r.rows) : "MISSING", r ? n(r.branches) : "–", r ? n(r.colleges) : "–"];
    }));
  }

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
  line("## College fields (all colleges, including those seen only in earlier years)");
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

  // 6. Fees (fee table, migration 004)
  const allCodes = (await rows<{ code: string }>("select code from college")).map((r) => r.code);
  line("## Fees (fee table)");
  if (!present.has("fee")) {
    line("The fee table does not exist yet (migration 004 not applied); the API serves the bundled fees.json.");
    line();
  } else {
    const feeRows = await rows<{ college_code: string; academic_year: string; source: string; tuition_fee: number | null }>(
      "select college_code, academic_year, source, tuition_fee from fee",
    );
    const withFee = new Set(feeRows.map((r) => r.college_code));
    const current = new Set((await rows<{ c: string }>("select distinct college_code c from cutoff where year = $1", [latest])).map((r) => r.c));
    const count = (pred: (r: (typeof feeRows)[number]) => boolean): number => feeRows.filter(pred).length;
    table(["check", "count"], [
      [`current (${latest}) colleges with a fee`, `${[...current].filter((c) => withFee.has(c)).length} of ${current.size}`],
      ["fee rows from the FRA report", count((r) => r.source === "FRA")],
      ["fee rows from college fee notices", count((r) => r.source === "college")],
      ["fee rows for 2026-27 / 2025-26", `${count((r) => r.academic_year === "2026-27")} / ${count((r) => r.academic_year === "2025-26")}`],
      ["fee rows with only a total (no split)", count((r) => r.tuition_fee === null)],
      ["fee rows for colleges not in the college table", feeRows.filter((r) => !allCodes.includes(r.college_code)).length],
    ]);
  }

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
