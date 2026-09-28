// Download the files listed in data/raw/<year>/manifest.json (cached, polite, %PDF-checked).
// Usage: npm run download -- [year] [--colleges 16006,03012,...] [--merit PCMAI] [--seat-matrix]
//   Cutoff lists and the institute list are always fetched. Allotment PDFs only for --colleges.
//   Merit lists only for --merit (Final stage). The seat matrix only with --seat-matrix.
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { downloadPdf, politeGet, type DownloadResult } from "../http.ts";
import { readManifest, type ManifestFile } from "../manifest.ts";
import { rawDir } from "../paths.ts";

const args = process.argv.slice(2);
const year = Number(args.find((a) => /^\d{4}$/.test(a)) ?? 2026);
const opt = (name: string): string[] => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1].split(",").map((s) => s.trim()).filter(Boolean) : [];
};
const colleges = new Set(opt("colleges"));
const merit = new Set(opt("merit"));
const seatMatrix = args.includes("--seat-matrix");

const manifest = await readManifest(year);
const dir = rawDir(year);
const tally: Record<DownloadResult, number> = { cached: 0, downloaded: 0, failed: 0 };
const failures: { url: string; detail: string }[] = [];

async function get(f: ManifestFile): Promise<void> {
  const r = await downloadPdf(f.url, join(dir, f.file));
  tally[r.result]++;
  if (r.result === "failed") failures.push({ url: f.url, detail: r.detail ?? "" });
  console.log(`[DOWNLOAD] ${r.result.padEnd(10)} ${f.file}${r.detail ? ` (${r.detail})` : ""}`);
}

// Institute list (HTML page, cached).
const instPath = join(dir, manifest.instituteList.file);
try {
  await stat(instPath);
  tally.cached++;
} catch {
  const r = await politeGet(manifest.instituteList.url);
  if (r.status === 200) {
    await mkdir(dirname(instPath), { recursive: true });
    await writeFile(instPath, r.body);
    tally.downloaded++;
  } else {
    tally.failed++;
    failures.push({ url: manifest.instituteList.url, detail: `HTTP ${r.status}` });
  }
}

for (const f of manifest.cutoffLists) await get(f);
for (const f of manifest.meritLists.filter((m) => m.stage === "Final" && merit.has(m.list))) await get(f);
if (seatMatrix) for (const f of manifest.seatMatrix ?? []) await get(f);
for (const f of manifest.allotmentPdfs.filter((a) => colleges.has(a.collegeCode))) await get(f);

const missing = [...colleges].filter((c) => !manifest.allotmentPdfs.some((a) => a.collegeCode === c));
if (missing.length) console.log(`[DOWNLOAD] not in manifest: ${missing.join(", ")}`);
console.log(`[DOWNLOAD] cached ${tally.cached}, downloaded ${tally.downloaded}, failed ${tally.failed}`);
await writeFile(join(dir, "download-log.json"), JSON.stringify({ at: new Date().toISOString(), tally, failures }, null, 2));
if (tally.failed) process.exitCode = 1;
