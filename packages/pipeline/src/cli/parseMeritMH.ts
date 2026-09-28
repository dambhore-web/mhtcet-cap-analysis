// Parse the Maharashtra state PCM merit list into data/processed/<year>/mh_merit.ndjson.
// Usage: npm run parse:merit:mh -- [year]
import { join } from "node:path";
import type { MeritRow } from "@mhtcet/core";
import { writeJson, writeNdjson } from "../io.ts";
import { processedDir, rawDir } from "../paths.ts";
import { readPages } from "../pdf.ts";
import { checkMeritList, parseMeritPageMH, type MeritParseIssue } from "../parse/merit.ts";

const year = Number(process.argv[2] ?? 2026);
const path = join(rawDir(year), "merit", "PCMMH_final.pdf");
const rows: MeritRow[] = [];
const issues: MeritParseIssue[] = [];
let page = 0;
const started = Date.now();
for await (const words of readPages(path)) {
  page++;
  rows.push(...parseMeritPageMH(words, page, issues));
  if (page % 500 === 0) console.log(`[MERIT-MH] page ${page}: ${rows.length} rows, ${Math.round((Date.now() - started) / 1000)} s`);
}
rows.sort((a, b) => a.merit - b.merit);
const check = checkMeritList(rows);
const out = processedDir(year);
await writeNdjson(join(out, "mh_merit.ndjson"), rows);
await writeJson(join(out, "mh_merit-check.json"), { pages: page, issues, check: { ...check, gaps: check.gaps.slice(0, 200), monotoneViolations: check.monotoneViolations.slice(0, 50), monotoneViolationCount: check.monotoneViolations.length } });
console.log(`[MERIT-MH] ${rows.length} rows from ${page} pages; issues ${issues.length}; gaps ${check.gaps.length}; duplicates ${check.duplicates}; monotone violations ${check.monotoneViolations.length}`);
