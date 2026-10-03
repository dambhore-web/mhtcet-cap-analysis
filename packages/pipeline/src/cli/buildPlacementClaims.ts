// Build packages/pipeline/data/college-placement-claims.json: the placement figures colleges publish
// on their own websites (highest, average and median package, placement %), from the page text
// saved by scripts/crawlPlacementPages.mjs in data/raw/placement-pages/ (issue #132).
// Every figure keeps the page URL and the sentence it was read from. Colleges whose home page did
// not load, or whose first pages share no word of the college's name, are left out.
// Figures read by hand from a college's own documents (data/placement-manual.json) replace the crawl.
// Usage: npm run placement:claims
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractClaims, summariseClaims, type ClaimMetric, type PlacementClaim } from "../parse/placementClaims.ts";
import { REPO_ROOT } from "../paths.ts";

interface CrawledPage { url: string; kind: string; status: number; text: string }
interface Crawl { code: string; home: string; crawledAt: string; pages: CrawledPage[] }

const DIR = join(REPO_ROOT, "data/raw/placement-pages");
const MANUAL = join(REPO_ROOT, "packages/pipeline/data/placement-manual.json");
const OUT = join(REPO_ROOT, "packages/pipeline/data/college-placement-claims.json");

// College names from the CAP institute list, to check that a crawled site is the college's own.
const listHtml = await readFile(join(REPO_ROOT, "data/raw/2026/html/instituteList.html"), "utf8");
const names = new Map<string, string>();
for (const m of listHtml.matchAll(/InstituteCode=(\d{4,5})"\s*>\s*\d{4,5}\s*<\/a>\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>/g)) {
  names.set(m[1].padStart(5, "0"), m[2].replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
}
const STOP = new Set("of and the in for college engineering technology institute institutes research management s trust society education educational shikshan mandal sanstha prasarak dr shri sri shree campus technical group institutions faculty tal dist pune mumbai nagpur nashik".split(" "));
const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)));

const colleges: Record<string, unknown> = {};
const skipped: Record<string, string> = {};
for (const f of (await readdir(DIR)).filter((f) => /^\d{5}\.json$/.test(f)).sort()) {
  const crawl = JSON.parse(await readFile(join(DIR, f), "utf8")) as Crawl;
  const home = crawl.pages[0];
  if (!home || !home.text || home.status >= 400 || home.status === 0) { skipped[crawl.code] = "home page did not load"; continue; }
  const want = tokens(names.get(crawl.code) ?? "");
  const seen = tokens(crawl.pages.slice(0, 2).map((p) => p.text.slice(0, 20_000)).join(" "));
  const overlap = [...want].filter((t) => seen.has(t)).length;
  if (want.size && overlap < 1) { skipped[crawl.code] = "site does not name the college"; continue; }
  const claims = crawl.pages.flatMap((p) => extractClaims(p.text ?? "", p.url));
  const summary = summariseClaims(claims);
  if (!summary) { skipped[crawl.code] = claims.length ? "no usable figure" : "no placement figures published"; continue; }
  colleges[crawl.code] = { crawledAt: crawl.crawledAt.slice(0, 10), home: crawl.home, ...summary };
}
// Figures read by hand from the college's own documents replace the crawled ones (data/placement-manual.json).
interface Manual { checkedAt: string; home: string; year: string | null; claims: PlacementClaim[] }
const manual = JSON.parse(await readFile(MANUAL, "utf8")) as { colleges: Record<string, Manual> };
for (const [code, m] of Object.entries(manual.colleges)) {
  const pick = (metric: ClaimMetric) => m.claims.find((x) => x.metric === metric)?.value ?? null;
  colleges[code] = {
    crawledAt: m.checkedAt, home: m.home, year: m.year,
    highest: pick("highest"), average: pick("average"), median: pick("median"), placedPct: pick("placedPct"),
    claims: m.claims,
  };
  delete skipped[code];
}
const out = {
  _note:
    "Placement figures colleges publish on their own websites (college's claims, not verified): the latest year's highest, average and median package (rupees per year) and placement %, each with the page and sentence it came from. Built by `npm run placement:claims` from pages crawled by scripts/crawlPlacementPages.mjs.",
  colleges,
  skipped,
};
await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
const reasons = Object.values(skipped).reduce<Record<string, number>>((a, r) => ({ ...a, [r]: (a[r] ?? 0) + 1 }), {});
console.log(`[PLACEMENT-CLAIMS] ${Object.keys(colleges).length} colleges with figures; skipped ${JSON.stringify(reasons)}`);
