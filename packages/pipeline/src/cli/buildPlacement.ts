// Build packages/pipeline/data/college-placement.json from the NIRF data PDFs listed in
// packages/pipeline/data/placement-sources.json (issue #132).
//
// Each listed PDF is the data an institution submitted to NIRF, as published on its own website
// (NIRF itself hosts only its top 100). The URLs were found on the colleges' NIRF pages and checked
// against the college (institute name in the PDF); this script only downloads what is listed:
// sequentially, ≥ 1 s apart, cached under data/raw/nirf/. PDFs are parsed with parse/nirf.ts.
// Usage: npm run placement [-- --offline]   (--offline: use cached PDFs only)
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseNirfPlacement, type PdfItem } from "../parse/nirf.ts";
import { REPO_ROOT } from "../paths.ts";
import { buildPlacementRows, type ParsedNirfDoc, type PlacementProblem } from "../placement/placementRows.ts";

const SOURCES = join(REPO_ROOT, "packages/pipeline/data/placement-sources.json");
const OUT = join(REPO_ROOT, "packages/pipeline/data/college-placement.json");
const CACHE = join(REPO_ROOT, "data/raw/nirf");
const MIN_GAP_MS = 1100;
const USER_AGENT = "Mozilla/5.0 (compatible; mhtcet-cap-analysis data pipeline; polite, cached)";
const offline = process.argv.includes("--offline");

/** College code → the college's name and its NIRF data PDFs; keys starting with "_" are notes. */
type Sources = Record<string, { name: string; pdfs: string[] }>;
const sources = JSON.parse(await readFile(SOURCES, "utf8")) as Sources;
await mkdir(CACHE, { recursive: true });

let last = 0;
async function download(url: string, dest: string): Promise<string | null> {
  if (existsSync(dest)) return null;
  if (offline) return "not cached";
  const wait = last + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  // College sites drop connections and DNS now and then: two more tries before giving up, so a
  // passing blip doesn't drop a college's figures (#134). HTTP errors and non-PDFs are not retried.
  let failure = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 5_000 * attempt));
    try {
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(90_000) });
      if (!res.ok) return `HTTP ${res.status}`;
      const body = Buffer.from(await res.arrayBuffer());
      if (body.subarray(0, 4).toString() !== "%PDF") return "not a PDF";
      await writeFile(dest, body);
      return null;
    } catch (err) {
      const cause = (err as { cause?: { code?: string } }).cause?.code;
      failure = cause ? `${(err as Error).message} (${cause})` : (err as Error).message;
    }
  }
  return `${failure} (3 tries)`;
}

async function readItems(path: string): Promise<PdfItem[]> {
  const doc = await getDocument({ data: new Uint8Array(await readFile(path)), verbosity: 0, useSystemFonts: false }).promise;
  try {
    const items: PdfItem[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, 40); p++) {
      const page = await doc.getPage(p);
      for (const it of (await page.getTextContent()).items) if ("str" in it) items.push({ page: p, str: it.str, transform: it.transform });
      page.cleanup();
    }
    return items;
  } finally {
    await doc.destroy();
  }
}

const docs: ParsedNirfDoc[] = [];
const problems: PlacementProblem[] = [];
const names = new Map<string, string>();
for (const [code, entry] of Object.entries(sources)) {
  if (code.startsWith("_")) continue;
  for (const url of entry.pdfs) {
    const dest = join(CACHE, `${code}_${createHash("md5").update(url).digest("hex").slice(0, 8)}.pdf`);
    const failed = await download(url, dest);
    if (failed) {
      problems.push({ collegeCode: code, sourceUrl: url, problem: `download failed: ${failed}` });
      continue;
    }
    const parsed = parseNirfPlacement(await readItems(dest));
    docs.push({ collegeCode: code, sourceUrl: url, parsed });
    if (parsed.instituteName) names.set(code, parsed.instituteName);
  }
}

const rows = buildPlacementRows(docs, problems);
const colleges: Record<string, unknown> = {};
for (const r of rows) {
  const c = (colleges[r.collegeCode] ??= { nirfName: names.get(r.collegeCode) ?? null, rows: [] }) as { rows: unknown[] };
  const { collegeCode: _code, ...rest } = r;
  c.rows.push(rest);
}
// A college whose PDFs all failed to download (site down for now) keeps its previous figures rather
// than vanishing from the app; parse problems still drop it, since those mean the data itself is wrong.
const previous = existsSync(OUT) ? ((JSON.parse(await readFile(OUT, "utf8")) as { colleges?: Record<string, unknown> }).colleges ?? {}) : {};
const kept: string[] = [];
for (const code of Object.keys(sources)) {
  if (code.startsWith("_") || colleges[code] || !previous[code]) continue;
  const downloadedAny = docs.some((d) => d.collegeCode === code);
  if (!downloadedAny) {
    colleges[code] = previous[code];
    kept.push(code);
  }
}
const out = {
  _note:
    "Placement of UG 4-year (B.E./B.Tech) graduates per college, from the data each institution submitted to NIRF and published on its website. Self-reported by the institution. Built by `npm run placement` from data/placement-sources.json.",
  // by college code, so kept entries do not move around between runs
  colleges: Object.fromEntries(Object.entries(colleges).sort(([p], [q]) => p.localeCompare(q))),
};
await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`[PLACEMENT] ${rows.length} rows for ${Object.keys(colleges).length} colleges from ${docs.length} PDFs`);
for (const p of problems) console.log(`[PLACEMENT] ${p.collegeCode} ${p.problem} (${p.sourceUrl})`);
for (const code of kept) console.log(`[PLACEMENT] ${code} kept its previous figures: none of its PDFs could be downloaded this time`);
