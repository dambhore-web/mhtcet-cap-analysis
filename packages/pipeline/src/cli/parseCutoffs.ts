// Parse every official cutoff list in the manifest into data/processed/<year>/cutoffs.ndjson.
// Usage: npm run parse:cutoffs -- [year]
import { join } from "node:path";
import type { AuthorityId, CutoffRow } from "@mhtcet/core";
import { writeJson, writeNdjson } from "../io.ts";
import { readManifest } from "../manifest.ts";
import { processedDir, rawDir } from "../paths.ts";
import { readPages } from "../pdf.ts";
import { MhCutoffParser, type MhBranch, type MhCollege, type ParseIssue } from "../parse/cutoffMh.ts";
import { AI_LAYOUT, DIPLOMA_LAYOUT, RowListParser } from "../parse/cutoffRows.ts";

const AUTHORITY: AuthorityId = "MH-CET-CELL";
const year = Number(process.argv[2] ?? 2026);
const manifest = await readManifest(year);
const rows: CutoffRow[] = [];
const colleges = new Map<string, MhCollege>();
const branches = new Map<string, MhBranch>();
const files: {
  file: string; kind: string; round: string; titleRounds: string[]; rows: number; issues: ParseIssue[]; serialProblems: string[];
}[] = [];

for (const f of manifest.cutoffLists) {
  const path = join(rawDir(year), f.file);
  const name = f.file.split("/").pop()!;
  const before = rows.length;
  if (f.kind === "MH") {
    const p = new MhCutoffParser();
    for await (const words of readPages(path)) p.addPage(words);
    for (const c of p.cells()) {
      rows.push({
        authority: AUTHORITY, exam: "MHT-CET", year, list: "MH", round: f.round,
        collegeCode: c.collegeCode, choiceCode: c.choiceCode, section: c.section, seatType: c.seatType, stage: c.stage,
        closingMerit: c.closingMerit, closingPercentile: c.closingPercentile, sourceFile: name, sourcePage: c.page,
      });
    }
    // Later rounds overwrite earlier ones, so names/status reflect the latest list.
    for (const [k, v] of p.colleges) colleges.set(k, v);
    for (const [k, v] of p.branches) branches.set(k, v);
    files.push({ file: name, kind: f.kind, round: f.round, titleRounds: [...p.titleRounds], rows: rows.length - before, issues: p.issues, serialProblems: [] });
  } else {
    const p = new RowListParser(f.kind === "AI" ? AI_LAYOUT : DIPLOMA_LAYOUT);
    for await (const words of readPages(path)) p.addPage(words);
    for (const r of p.rows) {
      rows.push({
        authority: AUTHORITY, exam: r.exam ?? "", year, list: f.kind, round: f.round,
        collegeCode: r.collegeCode, choiceCode: r.choiceCode,
        section: f.kind === "Diploma" ? "Diploma" : (r.type ?? ""), seatType: r.seatType ?? "", stage: "",
        closingMerit: r.closingMerit, closingPercentile: r.closingPercentile, sourceFile: name, sourcePage: r.page,
      });
    }
    files.push({ file: name, kind: f.kind, round: f.round, titleRounds: [...p.titleRounds], rows: rows.length - before, issues: p.issues, serialProblems: p.checkSerials() });
  }
  const last = files[files.length - 1];
  console.log(`[PARSE] ${name}: ${last.rows} rows, ${last.issues.length} issues, ${last.serialProblems.length} serial problems, title round ${last.titleRounds.join("/")}`);
}

const out = processedDir(year);
const n = await writeNdjson(join(out, "cutoffs.ndjson"), rows);
await writeJson(join(out, "cutoff-colleges.json"), { colleges: [...colleges.values()], branches: [...branches.values()] });
await writeJson(join(out, "cutoff-parse.json"), { year, parsedAt: new Date().toISOString(), files });
console.log(`[PARSE] ${n} cutoff rows, ${colleges.size} colleges, ${branches.size} branches -> ${out}`);
