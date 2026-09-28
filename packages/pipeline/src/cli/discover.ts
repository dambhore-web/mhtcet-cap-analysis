// Discover the year's source files on the CET Cell site and write data/raw/<year>/manifest.json.
// Usage: npm run discover -- [year]
// Earlier years (before CURRENT_YEAR) have no site of their own: their cutoff lists and seat matrix
// are linked from the current year's home page, and the current institute list stands in for theirs
// (colleges found only in the old cutoff lists are added at load time).
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { politeGet } from "../http.ts";
import { rawDir } from "../paths.ts";
import type { Manifest } from "../manifest.ts";
import {
  findAllotmentPdfs, findCutoffLists, findEarlierCutoffLists, findEarlierSeatMatrix, findEarlierYearLinks,
  findMeritLists, findSeatMatrix, hrefs,
} from "../discover.ts";

const CURRENT_YEAR = 2026;
const year = Number(process.argv[2] ?? CURRENT_YEAR);
const earlier = year < CURRENT_YEAR;
const base = `https://fe${earlier ? CURRENT_YEAR : year}.mahacet.org`;
const pages = {
  home: `${base}/`,
  instituteList: `${base}/StaticPages/frmInstituteList.aspx?did=1884`,
  allotmentList: `${base}/StaticPages/frmInstituteWiseAllotmentList.aspx?did=2021`,
};

const dir = rawDir(year);
await mkdir(join(dir, "html"), { recursive: true });

async function page(name: string, url: string): Promise<string> {
  const r = await politeGet(url);
  if (r.status !== 200) throw new Error(`[DISCOVER] ${url} -> HTTP ${r.status}`);
  await writeFile(join(dir, "html", `${name}.html`), r.body);
  console.log(`[DISCOVER] ${name}: ${r.body.length} bytes from ${r.finalUrl}`);
  return r.body.toString("utf8");
}

const home = await page("home", pages.home);
const links = hrefs(home);

const manifest: Manifest = earlier
  ? {
    year,
    discoveredAt: new Date().toISOString(),
    pages,
    cutoffLists: findEarlierCutoffLists(links, year),
    meritLists: [],
    seatMatrix: findEarlierSeatMatrix(links, year),
    instituteList: { url: pages.instituteList, file: "html/instituteList.html" },
    allotmentPdfs: [],
    earlierYearLinks: [],
  }
  : {
    year,
    discoveredAt: new Date().toISOString(),
    pages,
    cutoffLists: findCutoffLists(links, year),
    meritLists: findMeritLists(links, year),
    seatMatrix: findSeatMatrix(links, year),
    instituteList: { url: pages.instituteList, file: "html/instituteList.html" },
    allotmentPdfs: findAllotmentPdfs(await page("allotmentList", pages.allotmentList), year),
    earlierYearLinks: findEarlierYearLinks(links, year),
  };
if (earlier && manifest.cutoffLists.length === 0) throw new Error(`[DISCOVER] no ${year} cutoff lists linked from ${pages.home}`);
await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
const colleges = new Set(manifest.allotmentPdfs.map((a) => a.collegeCode)).size;
console.log(
  `[DISCOVER] cutoff lists ${manifest.cutoffLists.length}, merit lists ${manifest.meritLists.length}, ` +
    `seat matrix ${manifest.seatMatrix.length}, allotment PDFs ${manifest.allotmentPdfs.length} (${colleges} colleges), ` +
    `earlier-year links ${manifest.earlierYearLinks.length}`,
);
