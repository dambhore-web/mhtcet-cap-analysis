// Discover the year's source files on the CET Cell site and write data/raw/<year>/manifest.json.
// Usage: npm run discover -- [year]
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { politeGet } from "../http.ts";
import { rawDir } from "../paths.ts";
import type { Manifest } from "../manifest.ts";
import {
  findAllotmentPdfs, findCutoffLists, findEarlierYearLinks, findMeritLists, findSeatMatrix, hrefs,
} from "../discover.ts";

const year = Number(process.argv[2] ?? 2026);
const base = `https://fe${year}.mahacet.org`;
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
const allot = await page("allotmentList", pages.allotmentList);
const links = hrefs(home);

const manifest: Manifest = {
  year,
  discoveredAt: new Date().toISOString(),
  pages,
  cutoffLists: findCutoffLists(links, year),
  meritLists: findMeritLists(links, year),
  seatMatrix: findSeatMatrix(links, year),
  instituteList: { url: pages.instituteList, file: "html/instituteList.html" },
  allotmentPdfs: findAllotmentPdfs(allot, year),
  earlierYearLinks: findEarlierYearLinks(links, year),
};
await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
const colleges = new Set(manifest.allotmentPdfs.map((a) => a.collegeCode)).size;
console.log(
  `[DISCOVER] cutoff lists ${manifest.cutoffLists.length}, merit lists ${manifest.meritLists.length}, ` +
    `seat matrix ${manifest.seatMatrix.length}, allotment PDFs ${manifest.allotmentPdfs.length} (${colleges} colleges), ` +
    `earlier-year links ${manifest.earlierYearLinks.length}`,
);
