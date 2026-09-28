// Fetch the FRA engineering fee reports (or reuse the cached copies) and rebuild
// apps/api/src/data/fees.json for the current CAP colleges (#42).
// Usage: npm run fees -w @mhtcet/pipeline -- [--refresh]
// Needs data/processed/2026/institutes.json (npm run parse:institutes -- 2026).
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildFeeEntries, possibleRows, type CurrentCollege, type FeeReportInput } from "../fees/buildFees.ts";
import { parseFraReport } from "../fees/fraReport.ts";
import { politeGet } from "../http.ts";
import { readJson, writeJson } from "../io.ts";
import type { InstituteListRow } from "../parse/instituteList.ts";
import { DATA_DIR, REPO_ROOT, processedDir } from "../paths.ts";

const YEAR = 2026;
const QUERY = "district=all&institute=&sub_type=ENGG&type=HT";
/** Newest first: CAP 2026 admits pay 2026-27 fees; 2025-26 fills colleges the newer report lacks. */
const SOURCES = [
  { academicYear: "2026-27", file: "fra-engg-2026-27.html", url: `https://ay26-27.mahafraportal.org/ssi_prp_25/admin/reports/ajax/get_report_ajax.php?${QUERY}` },
  { academicYear: "2025-26", file: "fra-engg-2025-26.html", url: `https://ay25-26.mahafraportal.org/ssi_prp_24/admin/reports/ajax/get_report_ajax.php?${QUERY}` },
];
const SEARCH_PAGE = "https://ay26-27.mahafraportal.org/ssi_prp_25/outer.php?q=fee_search_report";
const RAW_DIR = join(DATA_DIR, "raw", "fra");
const OUT = join(REPO_ROOT, "apps", "api", "src", "data", "fees.json");
const refresh = process.argv.includes("--refresh");

async function cachedOrFetch(url: string, file: string): Promise<{ html: string; fetchedOn: string }> {
  const path = join(RAW_DIR, file);
  if (!refresh) {
    try {
      const s = await stat(path);
      console.log(`[FEES] cached ${file}`);
      return { html: await readFile(path, "utf8"), fetchedOn: s.mtime.toISOString().slice(0, 10) };
    } catch {
      // not cached
    }
  }
  const { status, body } = await politeGet(url);
  if (status !== 200) throw new Error(`[FEES] HTTP ${status} from ${url}`);
  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(path, body);
  console.log(`[FEES] downloaded ${file} (${body.length} bytes)`);
  return { html: body.toString("utf8"), fetchedOn: new Date().toISOString().slice(0, 10) };
}

const institutes = await readJson<InstituteListRow[]>(join(processedDir(YEAR), "institutes.json"));
const meta = await readJson<Record<string, { collegeType: string }>>(join(REPO_ROOT, "packages", "pipeline", "data", `college-meta-${YEAR}.json`));
const colleges: CurrentCollege[] = institutes
  .filter((i) => meta[i.code])
  .map((i) => ({ code: i.code, name: i.name, collegeType: meta[i.code].collegeType }));
if (colleges.length !== Object.keys(meta).length) throw new Error(`[FEES] ${Object.keys(meta).length - colleges.length} college-meta codes have no institute name`);

const reports: FeeReportInput[] = [];
let fetchedOn = "";
for (const s of SOURCES) {
  const got = await cachedOrFetch(s.url, s.file);
  fetchedOn = fetchedOn > got.fetchedOn ? fetchedOn : got.fetchedOn;
  const parsed = parseFraReport(got.html);
  if (parsed.academicYear !== s.academicYear) throw new Error(`[FEES] ${s.file} is for ${parsed.academicYear}, expected ${s.academicYear}`);
  if (parsed.issues.length) throw new Error(`[FEES] ${s.file}: ${parsed.issues.join("; ")}`);
  console.log(`[FEES] ${s.academicYear}: ${parsed.rows.length} rows`);
  reports.push({ academicYear: s.academicYear, reportUrl: s.url, rows: parsed.rows });
}

const { entries, unmatchedColleges, unusedRows } = buildFeeEntries(reports, colleges);

const count = (pick: (c: CurrentCollege) => string, codes: Iterable<string>) => {
  const out: Record<string, number> = {};
  for (const code of codes) {
    const k = pick(colleges.find((c) => c.code === code)!);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};
const values = [...entries.values()];
const byYear: Record<string, number> = {};
for (const e of values) byYear[e.academicYear] = (byYear[e.academicYear] ?? 0) + 1;

const file: Record<string, unknown> = {
  _meta: {
    source: "Fees Regulating Authority (FRA), Maharashtra: Fee Approved report, engineering (sub_type ENGG, type H&T)",
    url: SEARCH_PAGE,
    reportUrls: Object.fromEntries(SOURCES.map((s) => [s.academicYear, s.url])),
    year: SOURCES[0].academicYear,
    note:
      "Keyed by 5-digit CAP college code. Each entry's academicYear says which FRA report it comes from: 2026-27 (the fees CAP 2026 admits pay) or, when a college is not on that report yet, 2025-26. " +
      "Matched by FRA institute id (EN<code>, normalised) or, failing that, by exact normalised name. otherFees = totalAnnualFee - tuitionFee - developmentFee. " +
      "The FRA report states no TFWS information and no order reference or URL, so tfwsAvailable is false (not stated), tfwsSeats, fraOrderRef and fraOrderUrl are null. " +
      "Government, government-aided and university colleges are not on the FRA report (FRA approves fees of unaided private institutes) and have no entry.",
    lastUpdated: fetchedOn,
    fetchedOn,
    currentColleges: colleges.length,
    totalEntries: entries.size,
    entriesByYear: byYear,
    matchedByName: values.filter((e) => e.matchedBy === "name").map((e) => e.collegeCode),
    coverageByCollegeType: Object.fromEntries(
      Object.entries(count((c) => c.collegeType, colleges.map((c) => c.code))).map(([type, total]) => [
        type,
        { colleges: total, withFees: count((c) => c.collegeType, entries.keys())[type] ?? 0 },
      ]),
    ),
  },
};
for (const code of [...entries.keys()].sort()) file[code] = entries.get(code);
await writeFile(OUT, `${JSON.stringify(file, null, 2)}\n`);

const report = {
  builtAt: new Date().toISOString(),
  entries: entries.size,
  byYear,
  unmatchedColleges: unmatchedColleges.map((c) => ({ ...c, possibleFraRows: possibleRows(c, unusedRows).map((r) => `${r.instId} ${r.name} (${r.academicYear})`) })),
  unusedRows,
};
await writeJson(join(processedDir(YEAR), "fees-match-report.json"), report);

console.log(`[FEES] wrote ${entries.size} entries of ${colleges.length} current colleges: ${JSON.stringify(byYear)}`);
console.log(`[FEES] unmatched current colleges: ${unmatchedColleges.length}`);
for (const c of report.unmatchedColleges) {
  console.log(`  ${c.code} ${c.collegeType} | ${c.name} | ${c.reason}${c.possibleFraRows.length ? ` | possible: ${c.possibleFraRows.join("; ")}` : ""}`);
}
console.log(`[FEES] FRA rows not used: ${unusedRows.length} (details in data/processed/${YEAR}/fees-match-report.json)`);
