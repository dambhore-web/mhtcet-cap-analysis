// Validate the parsed 2026 data and write reports/run-<timestamp>.json (no personal data).
// Usage: npm run validate -- [year] [--skip-tests]
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { authorityRules, type AllotmentBranch, type AllotmentRow, type CutoffRow, type MeritRow } from "@mhtcet/core";
import { readJson, readNdjson, writeJson } from "../io.ts";
import { readManifest } from "../manifest.ts";
import { processedDir, REPO_ROOT, REPORTS_DIR } from "../paths.ts";
import type { InstituteListRow } from "../parse/instituteList.ts";
import { checkMeritList } from "../parse/merit.ts";
import { cutoffKey, findPersonalData, type CheckResult, type RunReport } from "../validate/report.ts";
import { crossCheck } from "../validate/crossCheck.ts";

const args = process.argv.slice(2);
const year = Number(args.find((a) => /^\d{4}$/.test(a)) ?? 2026);
const dir = processedDir(year);
const manifest = await readManifest(year);
const checks: CheckResult[] = [];
const add = (c: CheckResult): void => {
  checks.push(c);
  console.log(`[VALIDATE] ${c.pass ? "PASS" : "FAIL"} ${c.name}${c.blocking ? "" : " (informational)"}: ${c.summary}`);
};

// ---------- cutoff lists ----------
const cutoffs = await readNdjson<CutoffRow>(join(dir, "cutoffs.ndjson"));
const parseInfo = await readJson<{ files: { file: string; kind: string; round: string; titleRounds: string[]; rows: number; issues: unknown[]; serialProblems: string[] }[] }>(join(dir, "cutoff-parse.json"));
const badFiles = parseInfo.files.filter((f) => f.issues.length || f.serialProblems.length || f.titleRounds.join() !== f.round || f.rows === 0);
add({
  name: "cutoff-parse", blocking: true, pass: badFiles.length === 0,
  summary: `${parseInfo.files.length} files, ${cutoffs.length} rows; files with issues/serial gaps/round mismatch: ${badFiles.length}`,
  details: parseInfo.files.map((f) => ({ file: f.file, round: f.round, titleRounds: f.titleRounds, rows: f.rows, issues: f.issues.length, serialProblems: f.serialProblems.length })),
});

// Operator-verified values (docs/adr/ADR-006): a check fixture, not loaded data.
const VERIFIED: [string, string, number][] = [
  ["1600619110", "GOPENS", 4148], ["1600619110", "GSCS", 13137], ["1600619110", "GOBCS", 5736], ["1600619110", "TFWS", 3746],
  ["1600692110", "GOPENS", 365], ["1600692110", "GSCS", 4669], ["1600692110", "EWS", 1261], ["1600646410", "GOPENS", 1743],
];
const spot = VERIFIED.map(([code, st, v]) => {
  const got = cutoffs.filter((c) => c.list === "MH" && c.round === "I" && c.choiceCode === code && c.seatType === st && c.stage === "I" && c.section === "State Level");
  return { choiceCode: code, seatType: st, expected: v, got: got.map((g) => g.closingMerit) };
});
add({ name: "coep-verified-values", blocking: true, pass: spot.every((s) => s.got.length === 1 && s.got[0] === s.expected), summary: `${spot.filter((s) => s.got[0] === s.expected).length}/${spot.length} match`, details: spot });

const rules = authorityRules("MH-CET-CELL");
const badGrammar = cutoffs.filter((c) => c.list !== "Diploma" && !rules.parseSeatType(c.seatType));
add({
  name: "seat-type-grammar", blocking: false, pass: badGrammar.length === 0,
  summary: `${badGrammar.length} rows with a seat type outside the grammar (excluded from load)`,
  details: badGrammar.map((c) => ({ list: c.list, round: c.round, choiceCode: c.choiceCode, section: c.section, seatType: c.seatType })),
});

const keyCount = new Map<string, number>();
for (const c of cutoffs) keyCount.set(cutoffKey(c), (keyCount.get(cutoffKey(c)) ?? 0) + 1);
const dupKeys = [...keyCount].filter(([, n]) => n > 1).map(([k]) => k);
add({ name: "duplicate-cutoff-keys", blocking: false, pass: dupKeys.length === 0, summary: `${dupKeys.length} natural keys printed more than once (all rows for these keys excluded from load)`, details: dupKeys });

// ---------- coverage ----------
const institutes = await readJson<InstituteListRow[]>(join(dir, "institutes.json"));
const allotColleges = new Set(manifest.allotmentPdfs.map((a) => a.collegeCode));
const rounds = [...new Set(manifest.cutoffLists.filter((f) => f.kind === "MH").map((f) => f.round))];
const coverage = rounds.map((round) => {
  const withRows = new Set(cutoffs.filter((c) => c.round === round && c.list !== "Diploma").map((c) => c.collegeCode));
  const missing = institutes.filter((i) => !withRows.has(i.code)).map((i) => i.code);
  return { round, collegesWithRows: withRows.size, missing };
});
const unknownColleges = [...new Set(cutoffs.map((c) => c.collegeCode))].filter((c) => !institutes.some((i) => i.code === c));
add({
  name: "coverage", blocking: false, pass: coverage.every((c) => c.missing.length === 0) && unknownColleges.length === 0,
  summary: `institute list ${institutes.length}, allotment-list colleges ${allotColleges.size}; colleges without cutoff rows per round: ${coverage.map((c) => `${c.round}=${c.missing.length}`).join(", ")}; cutoff colleges not in institute list: ${unknownColleges.length}`,
  details: { coverage, unknownColleges },
});
add({ name: "institute-list", blocking: true, pass: institutes.length === allotColleges.size && institutes.every((i) => allotColleges.has(i.code)), summary: `${institutes.length} institutes; matches allotment-list college set: ${institutes.every((i) => allotColleges.has(i.code))}` });

// ---------- allotment lists (COEP + samples) ----------
const allotment = existsSync(join(dir, "allotment.ndjson")) ? await readNdjson<AllotmentRow>(join(dir, "allotment.ndjson")) : [];
const { branches } = existsSync(join(dir, "allotment-branches.json"))
  ? await readJson<{ branches: AllotmentBranch[] }>(join(dir, "allotment-branches.json"))
  : { branches: [] as AllotmentBranch[] };
const sampleColleges = [...new Set(allotment.map((r) => r.collegeCode))].sort();
const capSeats = sampleColleges.map((code) => {
  const lists = branches.filter((b) => b.collegeCode === code);
  const failures = lists.filter((b) => {
    const ews = (b.rowsBySeatType.EWS ?? 0) + (b.vacantBySeatType.EWS ?? 0);
    return b.capSeats === null || b.parsedRows + b.vacantRows - ews !== b.capSeats;
  });
  return { collegeCode: code, branchLists: lists.length, failures: failures.map((b) => ({ round: b.round, choiceCode: b.choiceCode, capSeats: b.capSeats, rows: b.parsedRows, vacant: b.vacantRows })) };
});
add({
  name: "cap-seats", blocking: true, pass: capSeats.every((c) => c.failures.length === 0),
  summary: capSeats.map((c) => `${c.collegeCode} ${c.branchLists - c.failures.length}/${c.branchLists}`).join(", ") + " (rows + VACANT - EWS supernumerary = CAP Seats)",
  details: capSeats,
});

const cross = sampleColleges.map((code) => {
  const rows = crossCheck(allotment, cutoffs, code);
  const byRound: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    byRound[r.round] ??= {};
    byRound[r.round][r.status] = (byRound[r.round][r.status] ?? 0) + 1;
  }
  const roundI = rows.filter((r) => r.round === "I");
  return {
    collegeCode: code, byRound,
    roundIExact: roundI.length > 0 && roundI.every((r) => r.status === "match"),
    nonMatches: rows.filter((r) => r.status !== "match"),
  };
});
add({
  name: "cutoff-cross-check-round-I", blocking: true, pass: cross.every((c) => c.roundIExact),
  summary: cross.map((c) => `${c.collegeCode} ${c.byRound.I?.match ?? 0}/${Object.values(c.byRound.I ?? {}).reduce((a, b) => a + b, 0)}`).join(", "),
  details: cross.map((c) => ({ collegeCode: c.collegeCode, byRound: c.byRound })),
});
add({
  name: "cutoff-cross-check-later-rounds", blocking: false,
  pass: cross.every((c) => c.nonMatches.length === 0),
  summary: cross.map((c) => { const t = Object.entries(c.byRound).filter(([r]) => r !== "I"); const all = t.reduce((a, [, v]) => a + Object.values(v).reduce((x, y) => x + y, 0), 0); const m = t.reduce((a, [, v]) => a + (v.match ?? 0), 0); return `${c.collegeCode} ${m}/${all}`; }).join(", "),
  details: cross.map((c) => ({ collegeCode: c.collegeCode, nonMatches: c.nonMatches })),
});

const parityAllot = existsSync(join(dir, "parity-allotment.json")) ? await readJson<{ baselineRows: number; tsRows: number; unexplainedMismatches: number; fieldMismatches: number; rowsAffected: number; byField: Record<string, number> }>(join(dir, "parity-allotment.json")) : null;
add({
  name: "allotment-parity-python", blocking: false, pass: !!parityAllot && parityAllot.tsRows === parityAllot.baselineRows && parityAllot.unexplainedMismatches === 0,
  summary: parityAllot ? `${parityAllot.tsRows}/${parityAllot.baselineRows} rows; ${parityAllot.rowsAffected} rows differ, all explained Python bugs (${JSON.stringify(parityAllot.byField)}); unexplained ${parityAllot.unexplainedMismatches}` : "not run",
});

// ---------- merit list ----------
const meritPath = join(dir, "ai_merit.ndjson");
let meritPass = false;
if (existsSync(meritPath)) {
  const merit = await readNdjson<MeritRow>(meritPath);
  const mc = checkMeritList(merit);
  const parityMerit = existsSync(join(dir, "parity-merit.json")) ? await readJson<{ baselineRows: number; missingInTs: number; fieldMismatches: number; extraInTs: number }>(join(dir, "parity-merit.json")) : null;
  meritPass = mc.rows >= 240114 && mc.jee.first === 1 && mc.jee.last === 98360 && mc.jee.count === 98360 && mc.jee.contiguous && mc.monotoneViolations.length === 0 && mc.duplicates === 0 && !!parityMerit && parityMerit.missingInTs === 0 && parityMerit.fieldMismatches === 0;
  add({
    name: "ai-merit-list", blocking: true, pass: meritPass,
    summary: `${mc.rows} rows (merit ${mc.minMerit}-${mc.maxMerit}, gaps ${mc.gaps.length}, duplicates ${mc.duplicates}); JEE ${mc.jee.first}-${mc.jee.last} count ${mc.jee.count} contiguous ${mc.jee.contiguous}; score increases within an exam: ${mc.monotoneViolations.length}; parity vs Python: ${parityMerit ? `missing ${parityMerit.missingInTs}, field mismatches ${parityMerit.fieldMismatches}, extra ${parityMerit.extraInTs}` : "not run"}`,
    details: { gaps: mc.gaps.slice(0, 100), monotoneViolations: mc.monotoneViolations.slice(0, 20) },
  });
}

// ---------- personal data ----------
const scanned: string[] = [];
const hits: string[] = [];
for (const f of await readdir(dir)) {
  if (!/\.(json|ndjson)$/.test(f)) continue;
  scanned.push(f);
  if (findPersonalData(await readFile(join(dir, f), "utf8"))) hits.push(f);
}
const allowedKeys = new Set(["year", "round", "collegeCode", "choiceCode", "branch", "section", "merit", "score", "gender", "category", "seatType"]);
const extraKeys = [...new Set(allotment.flatMap((r) => Object.keys(r)))].filter((k) => !allowedKeys.has(k));
add({ name: "no-personal-data", blocking: true, pass: hits.length === 0 && extraKeys.length === 0, summary: `${scanned.length} processed files scanned for EN########: ${hits.length} hits; unexpected allotment fields: ${extraKeys.length}`, details: { scanned, hits, extraKeys } });

// ---------- tests ----------
if (!args.includes("--skip-tests")) {
  let ok = true;
  let out = "";
  try {
    out = execSync("npx vitest run", { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    out += execSync("npm run typecheck", { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    ok = false;
    out = String((e as { stdout?: string }).stdout ?? e);
  }
  const m = /Tests\s+(\d+ passed[^\n]*)/.exec(out.replace(/\x1b\[[0-9;]*m/g, ""));
  add({ name: "typecheck-and-tests", blocking: true, pass: ok, summary: ok ? `typecheck ok; ${m ? m[1] : "tests passed"}` : "failed" });
}

// ---------- load plan ----------
const failingColleges = new Set<string>([
  ...capSeats.filter((c) => c.failures.length).map((c) => c.collegeCode),
  ...cross.filter((c) => !c.roundIExact).map((c) => c.collegeCode),
]);
const excludedFiles = badFiles.map((f) => f.file);
const globalBlock = checks.filter((c) => c.blocking && !c.pass && ["cutoff-parse", "coep-verified-values", "institute-list", "no-personal-data", "typecheck-and-tests"].includes(c.name));
const report: RunReport = {
  kind: "validation",
  year,
  createdAt: new Date().toISOString(),
  gitCommit: (() => { try { return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim(); } catch { return null; } })(),
  checks,
  load: {
    allowed: globalBlock.length === 0,
    blockedBy: globalBlock.map((c) => c.name),
    cutoffs: { excludedFiles, excludedColleges: [...failingColleges], excludedKeys: [...dupKeys, ...badGrammar.map(cutoffKey)] },
    merit: { allowed: meritPass },
  },
};
const stamp = report.createdAt.replace(/[:.]/g, "-");
await writeJson(join(REPORTS_DIR, `run-${stamp}.json`), report);
await writeJson(join(dir, "validation.json"), report);
console.log(`[VALIDATE] report reports/run-${stamp}.json; load allowed: ${report.load.allowed}; excluded colleges: ${[...failingColleges].join(",") || "none"}`);
if (!report.load.allowed) process.exitCode = 1;
