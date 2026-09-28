// Parse the seat matrix PDF in the manifest into data/processed/<year>/seat_matrix.ndjson and run
// its checks (data/processed/<year>/seat_matrix-check.json).
// Usage: npm run parse:seatmatrix -- <year>
// Needs: data/raw/<year>/seatmatrix/*.pdf (npm run download -- <year> --seat-matrix);
// for the cross-checks also cutoffs.ndjson and institutes.json of that year (parse:cutoffs,
// parse:institutes). Missing cross-check inputs are reported, not fatal.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { authorityRules, type CutoffRow } from "@mhtcet/core";
import { readJson, readNdjson, writeJson, writeNdjson } from "../io.ts";
import { readManifest } from "../manifest.ts";
import { processedDir, rawDir } from "../paths.ts";
import { readPages } from "../pdf.ts";
import type { InstituteListRow } from "../parse/instituteList.ts";
import {
  branchCells, checkBranch, MATRIX_ONLY_SEAT_TYPES, SeatMatrixParser, type SeatMatrixRow,
} from "../parse/seatMatrix.ts";
import { findPersonalData, type CheckResult } from "../validate/report.ts";

const year = Number(process.argv[2]);
if (!/^\d{4}$/.test(process.argv[2] ?? "")) throw new Error("usage: parse:seatmatrix <year>");
const manifest = await readManifest(year);
if (!manifest.seatMatrix?.length) throw new Error(`[PARSE-SM] no seat matrix in the ${year} manifest`);
const file = manifest.seatMatrix.at(-1)!; // latest version when several are listed
const sourceFile = file.file.split("/").pop()!;
const dir = processedDir(year);

const parser = new SeatMatrixParser();
for await (const words of readPages(join(rawDir(year), file.file))) parser.addPage(words);
const branches = parser.branches;

const rows: SeatMatrixRow[] = [];
for (const b of branches) {
  for (const c of branchCells(b)) {
    rows.push({
      authority: "MH-CET-CELL", exam: "MHT-CET", year, collegeCode: b.collegeCode, choiceCode: b.choiceCode,
      seatType: c.seatType, pool: c.pool, seats: c.seats, sourceFile, sourcePage: b.page,
    });
  }
}

const checks: CheckResult[] = [];
const add = (c: CheckResult): void => {
  checks.push(c);
  console.log(`[PARSE-SM] ${c.pass ? "PASS" : "FAIL"} ${c.name}${c.blocking ? "" : " (informational)"}: ${c.summary}`);
};

add({
  name: "seat-matrix-parse", blocking: true, pass: parser.issues.length === 0 && branches.length > 0,
  summary: `${branches.length} branches from ${sourceFile}; ${parser.issues.length} pages not parsed`,
  details: parser.issues,
});

const seen = new Map<string, number[]>();
for (const b of branches) seen.set(b.choiceCode, [...(seen.get(b.choiceCode) ?? []), b.page]);
const dupes = [...seen].filter(([, p]) => p.length > 1).map(([choiceCode, pages]) => ({ choiceCode, pages }));
add({ name: "seat-matrix-duplicate-branches", blocking: true, pass: dupes.length === 0, summary: `${dupes.length} choice codes printed more than once`, details: dupes });

const perBranch = branches.map((b) => ({ b, c: checkBranch(b) }));
const detail = (k: "rowTotals" | "intakeSplit" | "msSplit") =>
  perBranch.filter((x) => x.c[k].length).map((x) => ({ choiceCode: x.b.choiceCode, page: x.b.page, problems: x.c[k] }));
const rowTotals = detail("rowTotals");
add({ name: "seat-matrix-row-totals", blocking: true, pass: rowTotals.length === 0, summary: `${branches.length - rowTotals.length}/${branches.length} branches: every category row adds up to its printed Total`, details: rowTotals });
const intake = detail("intakeSplit");
add({ name: "seat-matrix-intake-split", blocking: true, pass: intake.length === 0, summary: `${branches.length - intake.length}/${branches.length} branches: SI = MS+MI+AI+institute and CAP Seats = MS+MI+AI`, details: intake });
const ms = detail("msSplit");
add({ name: "seat-matrix-ms-split", blocking: false, pass: ms.length === 0, summary: `${branches.length - ms.length}/${branches.length} branches: MS seats = level rows + PWD + DEF + orphan (a failure is an inconsistency in the source PDF)`, details: ms });

const nonPositive = rows.filter((r) => !Number.isInteger(r.seats) || r.seats <= 0);
add({ name: "seat-matrix-positive-rows", blocking: true, pass: nonPositive.length === 0 && rows.length > 0, summary: `${rows.length} rows; ${nonPositive.length} with seats <= 0 or not an integer`, details: nonPositive.slice(0, 50) });

const rules = authorityRules("MH-CET-CELL");
const extra = new Set<string>(MATRIX_ONLY_SEAT_TYPES);
const badTypes = [...new Set(rows.map((r) => r.seatType))].filter((t) => !extra.has(t) && !rules.parseSeatType(t));
add({ name: "seat-matrix-seat-types", blocking: true, pass: badTypes.length === 0, summary: `${badTypes.length} seat types outside the grammar (allowed extras: ${[...extra].join(", ")})`, details: badTypes });

add({ name: "seat-matrix-no-personal-data", blocking: true, pass: !findPersonalData(JSON.stringify(rows)) && !findPersonalData(JSON.stringify(branches)), summary: "no application-ID pattern in the output" });

// ---------- cross-checks against the same year's cutoff lists and institute list ----------
const cutoffPath = join(dir, "cutoffs.ndjson");
if (existsSync(cutoffPath)) {
  const cutoffCodes = new Set((await readNdjson<CutoffRow>(cutoffPath)).map((c) => c.choiceCode));
  const unknown = branches.filter((b) => !cutoffCodes.has(b.choiceCode)).map((b) => ({ choiceCode: b.choiceCode, college: b.collegeCode, course: b.courseName, page: b.page }));
  const matrixCodes = new Set(branches.map((b) => b.choiceCode));
  const notInMatrix = [...cutoffCodes].filter((c) => !matrixCodes.has(c)).sort();
  add({
    name: "seat-matrix-choice-codes", blocking: false, pass: unknown.length === 0,
    summary: `${unknown.length}/${branches.length} matrix choice codes not in the ${year} cutoff lists; ${notInMatrix.length} cutoff-list choice codes not in the matrix`,
    details: { notInCutoffs: unknown, notInMatrix },
  });
} else {
  add({ name: "seat-matrix-choice-codes", blocking: false, pass: false, summary: `skipped: ${cutoffPath} missing (run parse:cutoffs)` });
}

const instPath = join(dir, "institutes.json");
if (existsSync(instPath)) {
  const institutes = await readJson<InstituteListRow[]>(instPath);
  const byCode = new Map(institutes.map((i) => [i.code, i]));
  const perCollege = new Map<string, { name: string; si: number; branches: number }>();
  for (const b of branches) {
    const c = perCollege.get(b.collegeCode) ?? { name: b.collegeName, si: 0, branches: 0 };
    c.si += b.sanctionedIntake;
    c.branches++;
    perCollege.set(b.collegeCode, c);
  }
  const unknownColleges = [...perCollege.keys()].filter((c) => !byCode.has(c));
  const diffs = [...perCollege]
    .filter(([code]) => byCode.has(code))
    .map(([code, c]) => ({ collegeCode: code, name: c.name, branches: c.branches, matrixIntake: c.si, instituteListIntake: byCode.get(code)!.totalIntake, diff: c.si - (byCode.get(code)!.totalIntake ?? 0) }))
    .filter((d) => d.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  add({
    name: "seat-matrix-college-intake", blocking: false, pass: diffs.length === 0 && unknownColleges.length === 0,
    summary: `${perCollege.size} colleges; ${diffs.length} where the summed sanctioned intake differs from the institute list's total intake; ${unknownColleges.length} not in the institute list`,
    details: { unknownColleges, diffs },
  });
} else {
  add({ name: "seat-matrix-college-intake", blocking: false, pass: false, summary: `skipped: ${instPath} missing (run parse:institutes)` });
}

const byPool: Record<string, number> = {};
for (const r of rows) byPool[r.pool] = (byPool[r.pool] ?? 0) + r.seats;
const summary = {
  year, sourceFile, pages: parser.issues.length + branches.length, branches: branches.length,
  colleges: new Set(branches.map((b) => b.collegeCode)).size, rows: rows.length,
  sanctionedIntake: branches.reduce((s, b) => s + b.sanctionedIntake, 0),
  capSeats: branches.reduce((s, b) => s + b.capSeats, 0),
  seatsByPool: byPool,
  levelRows: { stateLevel: branches.filter((b) => b.levels.some((l) => l.level === "S")).length, homeUniversity: branches.filter((b) => b.levels.some((l) => l.level === "H")).length },
};
await writeNdjson(join(dir, "seat_matrix.ndjson"), rows);
await writeJson(join(dir, "seat_matrix-check.json"), {
  at: new Date().toISOString(), ...summary,
  blockingPass: checks.filter((c) => c.blocking).every((c) => c.pass),
  checks,
});
console.log(`[PARSE-SM] ${year}: ${summary.branches} branches, ${summary.colleges} colleges, ${summary.rows} rows -> ${dir}`);
if (!checks.filter((c) => c.blocking).every((c) => c.pass)) process.exitCode = 1;
