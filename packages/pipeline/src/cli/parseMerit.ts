// Parse a merit list into data/processed/<year>/ (merit, exam, score only):
//   PCMAI (All India, default) -> ai_merit.ndjson; PCMMH (Maharashtra State) -> mh_merit.ndjson.
// The exam is read from each row: the state list ends with Diploma and D.Voc. candidates, whose
// scores are marks (%), not MHT-CET percentiles.
// Usage: npm run parse:merit -- [year] [PCMAI|PCMMH]   (npm run parse:merit:mh -- [year] for PCMMH)
import { join } from "node:path";
import type { MeritRow } from "@mhtcet/core";
import { writeJson, writeNdjson } from "../io.ts";
import { processedDir, rawDir } from "../paths.ts";
import { readPages } from "../pdf.ts";
import { AI_MERIT_LAYOUT, checkMeritList, MH_MERIT_LAYOUT, parseMeritPage, type MeritParseIssue } from "../parse/merit.ts";

const args = process.argv.slice(2);
const year = Number(args.find((a) => /^\d{4}$/.test(a)) ?? 2026);
const list = (args.find((a) => /^[a-z]{5}$/i.test(a)) ?? "PCMAI").toUpperCase();
const LISTS: Record<string, { layout: typeof AI_MERIT_LAYOUT; out: string }> = {
  PCMAI: { layout: AI_MERIT_LAYOUT, out: "ai_merit" },
  PCMMH: { layout: MH_MERIT_LAYOUT, out: "mh_merit" },
};
const spec = LISTS[list];
if (!spec) throw new Error(`[MERIT] unknown list ${list}; use ${Object.keys(LISTS).join(" or ")}`);
const path = join(rawDir(year), "merit", `${list}_final.pdf`);
const rows: MeritRow[] = [];
const issues: MeritParseIssue[] = [];
let page = 0;
const started = Date.now();
for await (const words of readPages(path)) {
  page++;
  rows.push(...parseMeritPage(words, page, issues, spec.layout));
  if (page % 500 === 0) console.log(`[MERIT] page ${page}: ${rows.length} rows, ${Math.round((Date.now() - started) / 1000)} s`);
}
rows.sort((a, b) => a.merit - b.merit);
const check = checkMeritList(rows);
const out = processedDir(year);
await writeNdjson(join(out, `${spec.out}.ndjson`), rows);
await writeJson(join(out, `${spec.out}-check.json`), { pages: page, issues, check: { ...check, gaps: check.gaps.slice(0, 200), monotoneViolations: check.monotoneViolations.slice(0, 50), monotoneViolationCount: check.monotoneViolations.length } });
console.log(`[MERIT] ${list}: ${rows.length} rows from ${page} pages; issues ${issues.length}; gaps ${check.gaps.length}; duplicates ${check.duplicates}; JEE ${check.jee.first}-${check.jee.last} (${check.jee.count}, contiguous ${check.jee.contiguous}); monotone violations ${check.monotoneViolations.length}`);
