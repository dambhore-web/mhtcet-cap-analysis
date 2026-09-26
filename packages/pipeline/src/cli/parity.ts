// One-off parity check of the TypeScript parsers against the Python baseline CSVs (TASK-0002).
// Usage: tsx src/cli/parity.ts allotment <coep.csv> [year]
//        tsx src/cli/parity.ts merit <ai_merit.csv> [year]
// The baseline CSVs hold no names or IDs. Writes data/processed/<year>/parity-<kind>.json.
import { join } from "node:path";
import type { AllotmentRow, MeritRow } from "@mhtcet/core";
import { readCsv, readNdjson, writeJson } from "../io.ts";
import { processedDir } from "../paths.ts";

const [kind, csvPath, yearArg] = process.argv.slice(2);
if (!kind || !csvPath) throw new Error("usage: parity <allotment|merit> <baseline.csv> [year]");
const year = Number(yearArg ?? 2026);
const base = await readCsv(csvPath);
const numEq = (a: string, b: number | null): boolean => (a === "" ? b === null : b !== null && Number(a) === b);
const strEq = (a: string, b: string | null): boolean => (a === "" ? b === null || b === "" : a === b);

let result: Record<string, unknown>;
if (kind === "allotment") {
  const ts = (await readNdjson<AllotmentRow>(join(processedDir(year), "allotment.ndjson"))).filter((r) => r.collegeCode === "16006");
  const fields: [string, (b: Record<string, string>, t: AllotmentRow) => boolean][] = [
    ["round", (b, t) => b.round === t.round],
    ["branch_code", (b, t) => b.branch_code === t.choiceCode],
    ["branch", (b, t) => b.branch === t.branch],
    ["section", (b, t) => b.section === t.section],
    ["merit", (b, t) => numEq(b.merit, t.merit)],
    ["score", (b, t) => numEq(b.score, t.score)],
    ["gender", (b, t) => strEq(b.gender, t.gender)],
    ["category", (b, t) => strEq(b.category, t.category)],
    ["seat_type", (b, t) => strEq(b.seat_type, t.seatType)],
  ];
  const mismatches: { round: string; index: number; field: string; baseline: string; ts: unknown }[] = [];
  // Compare round by round, row by row in page order (the baseline file is ordered I, II, III, IV).
  let n = 0;
  const perRound: Record<string, { baseline: number; ts: number }> = {};
  for (const round of ["I", "II", "III", "IV"]) {
  const bR = base.filter((b) => b.round === round);
  const tR = ts.filter((t) => t.round === round);
  perRound[round] = { baseline: bR.length, ts: tR.length };
  for (let i = 0; i < Math.min(bR.length, tR.length); i++) {
    n++;
    const bi = bR[i];
    const ti = tR[i];
    for (const [f, eq] of fields) {
      if (!eq(bi, ti)) {
        const key = f === "branch_code" ? "choiceCode" : f === "seat_type" ? "seatType" : f;
        // Only numeric/code fields are echoed; none of them is personal data.
        mismatches.push({ round, index: i, field: f, baseline: bi[f], ts: (ti as unknown as Record<string, unknown>)[key] });
      }
    }
  }
  }
  const byField: Record<string, number> = {};
  const pairs = new Map<string, number>();
  for (const m of mismatches) {
    byField[m.field] = (byField[m.field] ?? 0) + 1;
    const k = `${m.round} ${m.field}: ${m.baseline} -> ${String(m.ts)}`;
    pairs.set(k, (pairs.get(k) ?? 0) + 1);
  }
  // Known, intended differences from the Python prototype (each is a Python bug fixed in TS):
  // - branch_code: Python took the first branch header on a page, so a TFWS list (`…1T`) that
  //   starts mid-page was filed under the previous branch; TS splits by header position.
  // - category: Python kept only the first word in x 440-510, truncating "NT 2 (NT-C)" to "NT" or "2".
  // - seat_type: Python missed a seat type glued to the category text by the PDF.
  const explained = (m: (typeof mismatches)[number]): boolean => {
    const t = String(m.ts ?? "");
    if (m.field === "branch_code") return t === m.baseline.replace(/0$/, "1T");
    if (m.field === "category") return m.baseline !== "" && t.split(/[ /]/).some((w) => w.includes(m.baseline));
    if (m.field === "seat_type") return m.baseline === "" && t !== "";
    return false;
  };
  const unexplained = mismatches.filter((m) => !explained(m));
  const rowsAffected = new Set(mismatches.map((m) => `${m.round}:${m.index}`)).size;
  result = {
    kind, baselineRows: base.length, tsRows: ts.length, comparedRows: n, perRound, fieldMismatches: mismatches.length, rowsAffected, byField,
    unexplainedMismatches: unexplained.length, unexplainedExamples: unexplained.slice(0, 20),
    distinct: [...pairs].sort((a, b) => b[1] - a[1]).map(([k, c]) => `${c}x ${k}`),
  };
} else if (kind === "merit") {
  const ts = await readNdjson<MeritRow>(join(processedDir(year), "ai_merit.ndjson"));
  const byMerit = new Map(ts.map((r) => [r.merit, r]));
  let missingInTs = 0;
  let fieldMismatches = 0;
  const examples: unknown[] = [];
  for (const b of base) {
    const t = byMerit.get(Number(b.merit));
    if (!t) { missingInTs++; if (examples.length < 20) examples.push({ merit: b.merit, issue: "missing in TS" }); continue; }
    if (t.exam !== b.exam || t.score !== Number(b.score)) {
      fieldMismatches++;
      if (examples.length < 20) examples.push({ merit: b.merit, baseline: [b.exam, b.score], ts: [t.exam, t.score] });
    }
  }
  const baseSet = new Set(base.map((b) => Number(b.merit)));
  const extraInTs = ts.filter((r) => !baseSet.has(r.merit)).map((r) => r.merit);
  result = { kind, baselineRows: base.length, tsRows: ts.length, missingInTs, fieldMismatches, extraInTs: extraInTs.length, extraExamples: extraInTs.slice(0, 30), examples };
} else {
  throw new Error(`unknown kind ${kind}`);
}
await writeJson(join(processedDir(year), `parity-${kind}.json`), result);
console.log(JSON.stringify(result, null, 1).slice(0, 3000));
