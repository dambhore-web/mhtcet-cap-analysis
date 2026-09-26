// Parse the downloaded institute-wise allotment PDFs into data/processed/<year>/allotment.ndjson
// (no names, no application IDs) and allotment-branches.json (printed seat counts per branch).
// Usage: npm run parse:allotment -- [year] [--colleges 16006,03012]
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { isRound, type AllotmentBranch, type AllotmentRow } from "@mhtcet/core";
import { writeJson, writeNdjson } from "../io.ts";
import { processedDir, rawDir } from "../paths.ts";
import { readPages } from "../pdf.ts";
import { AllotmentParser } from "../parse/allotment.ts";

const args = process.argv.slice(2);
const year = Number(args.find((a) => /^\d{4}$/.test(a)) ?? 2026);
const ci = args.indexOf("--colleges");
const only = ci >= 0 ? new Set(args[ci + 1].split(",")) : null;
const dir = join(rawDir(year), "allotment");
const rows: AllotmentRow[] = [];
const branches: AllotmentBranch[] = [];
const issues: { file: string; page: number; kind: string }[] = [];

for (const f of (await readdir(dir)).filter((f) => /^CAPR-[IVX]+_\d{4,5}\.pdf$/.test(f)).sort()) {
  const [, round, code] = /^CAPR-([IVX]+)_(\d+)\.pdf$/.exec(f)!;
  if (only && !only.has(code)) continue;
  if (!isRound(round)) throw new Error(`[PARSE] bad round in ${f}`);
  const p = new AllotmentParser(year, round, code);
  for await (const words of readPages(join(dir, f))) p.addPage(words);
  rows.push(...p.rows);
  branches.push(...p.branches.values());
  issues.push(...p.issues.map((i) => ({ file: f, page: i.page, kind: i.kind })));
  console.log(`[PARSE] ${f}: ${p.rows.length} rows, ${p.branches.size} branch lists, ${p.issues.length} issues`);
}
const out = processedDir(year);
await writeNdjson(join(out, "allotment.ndjson"), rows);
await writeJson(join(out, "allotment-branches.json"), { branches, issues });
console.log(`[PARSE] ${rows.length} allotment rows -> ${out}`);
