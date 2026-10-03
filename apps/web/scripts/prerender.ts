// Writes a ready-made HTML file per public URL after `vite build` (SEO).
//
// The app renders in the browser, so crawlers and link previews (WhatsApp, LinkedIn, AI crawlers)
// that don't run JavaScript would see only index.html's generic tags. This step copies the built
// index.html for every public page and fills in that page's title, description, canonical URL,
// share tags and structured data, plus a plain-HTML version of its key content inside #root. The
// app then starts as usual and replaces that content. Titles and descriptions come from the same
// functions the app uses (src/lib/seo.ts), so the two can't drift apart.
//
// Runs only when VITE_SITE_URL is set (production), like sitemap.xml; the data comes from the API's
// GET /api/seo-pages (SITEMAP_API_URL, else VITE_API_URL). Files are written as <path>.html, which
// `serve` maps to the clean URL without a redirect.
// Usage: npx tsx scripts/prerender.ts   (from apps/web, after vite build)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { branchMeta, collegeMeta, fullTitle, SITE_NAME, STATIC_PAGE_META, type PageMeta } from "../src/lib/seo.ts";
import { seatTypeLabel } from "../src/lib/seatType.ts";
import {
  collegeRows, DISTRICT_HUB_PATH, districtIntro, districtLabel, districtMeta, districtPath, formatLakh, groupIntro, groupMeta,
  groupPath, groupRows, hubMeta, noFeeText, SOURCES_NOTE, type DistrictCollege, type DistrictDetail,
} from "../src/lib/districts.ts";

export interface SeoBranch {
  choiceCode: string;
  name: string;
  roundI: number | null;
  latest: number;
  seatType: string;
  years: number[];
}
export interface SeoCollege {
  code: string;
  name: string;
  district: string | null;
  collegeType: string | null;
  branches: SeoBranch[];
}
export interface SeoData {
  year: number;
  colleges: SeoCollege[];
  /** District landing pages, from GET /api/districts/:slug for each district. */
  districts?: DistrictDetail[];
}

export interface Page {
  path: string;
  meta: PageMeta;
  /** HTML put inside #root, shown until the app starts */
  body: string;
  jsonLd: object[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number | null) => (n == null ? "–" : n.toLocaleString("en-IN"));

function breadcrumb(siteUrl: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: siteUrl + it.path })),
  };
}

function collegeEntity(c: SeoCollege) {
  return {
    "@type": "CollegeOrUniversity",
    name: c.name,
    address: { "@type": "PostalAddress", ...(c.district ? { addressLocality: c.district } : {}), addressRegion: "Maharashtra", addressCountry: "IN" },
  };
}

const NOTE = `<p>Closing merit numbers from the official State CET Cell CAP lists. Past cutoffs describe what happened, not what will happen.</p>`;

export function collegePage(siteUrl: string, year: number, c: SeoCollege): Page {
  const path = `/colleges/${c.code}`;
  const rows = c.branches
    .map((b) => `<tr><td><a href="${path}/${b.choiceCode}">${esc(b.name)}</a></td><td>${num(b.roundI)}</td><td>${num(b.latest)}</td><td>${esc(seatTypeLabel(b.seatType))}</td></tr>`)
    .join("");
  const meta = collegeMeta(c, c.branches.length, year);
  const body =
    `<main class="page prerendered"><nav aria-label="Breadcrumb"><a href="/colleges">Colleges</a></nav>` +
    `<h1>${esc(c.name)}</h1><p>${esc(meta.description ?? "")}</p>` +
    `<table><caption>CAP ${year} closing merit numbers, open seats</caption><thead><tr><th>Branch</th><th>Round I</th><th>Last round</th><th>Seat type</th></tr></thead><tbody>${rows}</tbody></table>` +
    `${NOTE}</main>`;
  return {
    path,
    meta,
    body,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebPage", name: fullTitle(meta.title), url: siteUrl + path, about: collegeEntity(c) },
      breadcrumb(siteUrl, [{ name: "Colleges", path: "/colleges" }, { name: c.name, path }]),
    ],
  };
}

export function branchPage(siteUrl: string, year: number, c: SeoCollege, b: SeoBranch): Page {
  const path = `/colleges/${c.code}/${b.choiceCode}`;
  const meta = branchMeta(c.name, b.name, b.years);
  const body =
    `<main class="page prerendered"><nav aria-label="Breadcrumb"><a href="/colleges">Colleges</a> / <a href="/colleges/${c.code}">${esc(c.name)}</a></nav>` +
    `<h1>${esc(b.name)}, ${esc(c.name)}</h1><p>${esc(meta.description ?? "")}</p>` +
    `<dl><dt>CAP ${year}, Round I closing</dt><dd>${num(b.roundI)}</dd><dt>CAP ${year}, last round closing</dt><dd>${num(b.latest)}</dd>` +
    `<dt>Seat type</dt><dd>${esc(seatTypeLabel(b.seatType))}</dd><dt>Years of data</dt><dd>${b.years.join(", ")}</dd></dl>` +
    `<p>Choice code ${esc(b.choiceCode)}.</p>${NOTE}</main>`;
  return {
    path,
    meta,
    body,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebPage", name: fullTitle(meta.title), url: siteUrl + path, about: collegeEntity(c) },
      breadcrumb(siteUrl, [{ name: "Colleges", path: "/colleges" }, { name: c.name, path: `/colleges/${c.code}` }, { name: b.name, path }]),
    ],
  };
}

export function staticPage(siteUrl: string, path: string, data: SeoData): Page {
  const meta = STATIC_PAGE_META[path];
  // the colleges list doubles as a crawl path to every college page
  const list =
    path === "/colleges"
      ? `<ul>${data.colleges.map((c) => `<li><a href="/colleges/${c.code}">${esc(c.name)}</a></li>`).join("")}</ul>`
      : `<p><a href="/colleges">All colleges</a> · <a href="/branches">By branch</a> · <a href="/guide">How CAP works</a></p>`;
  return {
    path,
    meta,
    body: `<main class="page prerendered"><h1>${esc(meta.title)}</h1><p>${esc(meta.description ?? "")}</p>${list}</main>`,
    jsonLd: [{ "@context": "https://schema.org", "@type": "WebPage", name: fullTitle(meta.title), url: siteUrl + path }],
  };
}

// ─── District landing pages ────────────────────────────────────────────────

const HUB_CRUMB = [{ name: "Colleges", path: "/colleges" }, { name: "By district", path: DISTRICT_HUB_PATH }];

const feeCell = (c: DistrictCollege) => (c.fee ? `₹${c.fee.total.toLocaleString("en-IN")} (FRA, ${esc(c.fee.year)})` : noFeeText(c.collegeType));
const salaryCell = (c: DistrictCollege) =>
  c.placement ? `${formatLakh(c.placement.medianSalary)} (NIRF, batch ${esc(c.placement.graduationYear)})` : "Not published";

function collegeList(siteUrl: string, name: string, colleges: DistrictCollege[]) {
  return {
    "@type": "ItemList",
    name,
    itemListElement: colleges.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `${siteUrl}/colleges/${c.code}` })),
  };
}

export function hubPage(siteUrl: string, year: number, districts: DistrictDetail[]): Page {
  const meta = hubMeta(districts.length, year);
  const items = districts
    .map((d) => {
      const groups = d.groups.map((g) => `<a href="${groupPath(d.slug, g.slug)}">${esc(g.name)}</a>`).join(" · ");
      return `<li><a href="${districtPath(d.slug)}">${esc(districtLabel(d.name))}</a>: ${d.colleges.length} ${d.colleges.length === 1 ? "college" : "colleges"}${groups ? ` (${groups})` : ""}</li>`;
    })
    .join("");
  return {
    path: DISTRICT_HUB_PATH,
    meta,
    body:
      `<main class="page prerendered"><nav aria-label="Breadcrumb"><a href="/colleges">Colleges</a></nav>` +
      `<h1>Engineering colleges by district</h1><p>${esc(meta.description ?? "")}</p><ul>${items}</ul><p>${esc(SOURCES_NOTE)}</p></main>`,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: fullTitle(meta.title), url: siteUrl + DISTRICT_HUB_PATH },
      breadcrumb(siteUrl, HUB_CRUMB),
    ],
  };
}

export function districtPage(siteUrl: string, d: DistrictDetail, all: DistrictDetail[]): Page {
  const path = districtPath(d.slug);
  const meta = districtMeta(d);
  const place = districtLabel(d.name);
  const rows = collegeRows(d.colleges)
    .map(
      ({ college: c, top }) =>
        `<tr><td><a href="/colleges/${c.code}">${esc(c.name)}</a>${c.collegeType ? ` (${esc(c.collegeType)})` : ""}</td>` +
        `<td>${num(top.roundI ?? top.latest)}, <a href="/colleges/${c.code}/${top.choiceCode}">${esc(top.name)}</a>${top.roundI === null ? " (last round)" : ""}</td>` +
        `<td>${c.branches.length}</td><td>${feeCell(c)}</td><td>${salaryCell(c)}</td></tr>`,
    )
    .join("");
  const groups = d.groups.map((g) => `<li><a href="${groupPath(d.slug, g.slug)}">${esc(g.name)} engineering colleges in ${esc(place)}</a></li>`).join("");
  const others = all.filter((o) => o.slug !== d.slug).map((o) => `<a href="${districtPath(o.slug)}">${esc(districtLabel(o.name))}</a>`).join(" · ");
  return {
    path,
    meta,
    body:
      `<main class="page prerendered"><nav aria-label="Breadcrumb"><a href="/colleges">Colleges</a> / <a href="${DISTRICT_HUB_PATH}">By district</a></nav>` +
      `<h1>Engineering colleges in ${esc(place)}</h1><p>${esc(districtIntro(d))}</p>` +
      (groups ? `<ul>${groups}</ul>` : "") +
      `<table><caption>CAP ${d.year}: each college's lowest closing merit number on open seats</caption><thead><tr><th>College</th><th>Lowest closing</th><th>Branches</th><th>Fee per year</th><th>Median salary</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<p>${esc(SOURCES_NOTE)}</p>${others ? `<p>Other districts: ${others}</p>` : ""}</main>`,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: fullTitle(meta.title), url: siteUrl + path, mainEntity: collegeList(siteUrl, meta.title, d.colleges) },
      breadcrumb(siteUrl, [...HUB_CRUMB, { name: place, path }]),
    ],
  };
}

export function districtGroupPage(siteUrl: string, d: DistrictDetail, groupSlug: string, all: DistrictDetail[]): Page | null {
  const group = d.groups.find((g) => g.slug === groupSlug);
  if (!group) return null;
  const path = groupPath(d.slug, group.slug);
  const meta = groupMeta(d, group.name);
  const place = districtLabel(d.name);
  const branchRows = groupRows(d.colleges, group.name);
  const rows = branchRows
    .map(
      ({ college: c, branch: b }) =>
        `<tr><td><a href="/colleges/${c.code}">${esc(c.name)}</a>: <a href="/colleges/${c.code}/${b.choiceCode}">${esc(b.name)}</a></td>` +
        `<td>${num(b.roundI)}</td><td>${num(b.latest)}</td><td>${feeCell(c)}</td><td>${salaryCell(c)}</td></tr>`,
    )
    .join("");
  const others = all
    .filter((o) => o.slug !== d.slug && o.groups.some((g) => g.slug === group.slug))
    .map((o) => `<a href="${groupPath(o.slug, group.slug)}">${esc(districtLabel(o.name))}</a>`)
    .join(" · ");
  const colleges = [...new Map(branchRows.map((r) => [r.college.code, r.college])).values()];
  return {
    path,
    meta,
    body:
      `<main class="page prerendered"><nav aria-label="Breadcrumb"><a href="/colleges">Colleges</a> / <a href="${DISTRICT_HUB_PATH}">By district</a> / <a href="${districtPath(d.slug)}">${esc(place)}</a></nav>` +
      `<h1>${esc(group.name)} engineering colleges in ${esc(place)}</h1><p>${esc(groupIntro(d, group.name))}</p>` +
      `<table><caption>CAP ${d.year} closing merit numbers, open seats</caption><thead><tr><th>College and branch</th><th>Round I</th><th>Last round</th><th>Fee per year</th><th>Median salary</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<p>${esc(SOURCES_NOTE)}</p><p><a href="${districtPath(d.slug)}">All engineering colleges in ${esc(place)}</a></p>` +
      `${others ? `<p>${esc(group.name)} colleges in other districts: ${others}</p>` : ""}</main>`,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: fullTitle(meta.title), url: siteUrl + path, mainEntity: collegeList(siteUrl, meta.title, colleges) },
      breadcrumb(siteUrl, [...HUB_CRUMB, { name: place, path: districtPath(d.slug) }, { name: group.name, path }]),
    ],
  };
}

/** The site-wide entity, added to the home page. */
export function siteJsonLd(siteUrl: string) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: siteUrl + "/" };
}

/** index.html with this page's head tags and body content. */
export function renderPage(template: string, siteUrl: string, page: Page): string {
  const title = fullTitle(page.meta.title);
  const url = siteUrl + (page.path === "/" ? "/" : page.path);
  const desc = page.meta.description ?? "";
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(desc)}" />`);
  const extra =
    `<link rel="canonical" href="${esc(url)}" />\n    <meta property="og:url" content="${esc(url)}" />\n` +
    page.jsonLd.map((j) => `    <script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>\n`).join("");
  html = html.replace("</head>", `    ${extra}  </head>`);
  // only the page's own content goes inside #root; React replaces it when the app starts
  html = html.replace(/<div id="root"><\/div>/, `<div id="root">${page.body}</div>`);
  return html;
}

export function allPages(siteUrl: string, data: SeoData): Page[] {
  const pages: Page[] = Object.keys(STATIC_PAGE_META)
    .filter((p) => p !== "/")
    .map((p) => staticPage(siteUrl, p, data));
  for (const c of data.colleges) {
    pages.push(collegePage(siteUrl, data.year, c));
    for (const b of c.branches) pages.push(branchPage(siteUrl, data.year, c, b));
  }
  const districts = data.districts ?? [];
  if (districts.length) {
    pages.push(hubPage(siteUrl, data.year, districts));
    for (const d of districts) {
      pages.push(districtPage(siteUrl, d, districts));
      for (const g of d.groups) {
        const p = districtGroupPage(siteUrl, d, g.slug, districts);
        if (p) pages.push(p);
      }
    }
  }
  return pages;
}

/** /colleges/16006 → colleges/16006.html (served at the clean URL by `serve`). */
export const fileFor = (path: string) => `${path.replace(/^\//, "")}.html`;

/**
 * Routes that only the app renders (personal or state-dependent, noindex): served index.html with
 * 200. Everything prerendered is served from its own file; any other URL gets 404.html (the app,
 * which shows "not found") with a 404 status. test/prerender.test.ts checks this list against
 * App.tsx, so a new route can't be forgotten.
 */
export const APP_ONLY_ROUTES = [
  "/find",
  "/compare",
  "/list",
  "/list/**",
  "/ask",
  "/profile",
  "/profile/**",
  "/signin",
  "/plans",
  "/simulator",
  "/allotment",
  "/export",
  "/summary",
  "/welcome",
  "/welcome/**",
];

/** serve.json once per-page HTML exists: app-only routes to index.html, the rest from files. */
export function prerenderedServeConfig(existing: { headers?: unknown[] }) {
  return {
    ...existing,
    cleanUrls: true,
    rewrites: APP_ONLY_ROUTES.map((source) => ({ source, destination: "/index.html" })),
  };
}

/** Every district's detail, for the district landing pages. A failed call fails the build. */
async function fetchDistricts(api: string): Promise<DistrictDetail[]> {
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${api}${path}`);
    if (!res.ok) throw new Error(`[prerender] ${api}${path} answered ${res.status}`);
    return (await res.json()) as T;
  };
  const { districts } = await get<{ districts: { slug: string }[] }>("/api/districts");
  return Promise.all(districts.map((d) => get<DistrictDetail>(`/api/districts/${encodeURIComponent(d.slug)}`)));
}

async function main() {
  const siteUrl = (process.env.VITE_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!siteUrl) {
    console.log("[prerender] VITE_SITE_URL unset: no per-page HTML (the site is not public)");
    return;
  }
  const api = (process.env.SITEMAP_API_URL || process.env.VITE_API_URL || "").replace(/\/+$/, "");
  if (!api) throw new Error("[prerender] set VITE_API_URL or SITEMAP_API_URL");
  const res = await fetch(`${api}/api/seo-pages`);
  if (!res.ok) throw new Error(`[prerender] ${api}/api/seo-pages answered ${res.status}`);
  const data = (await res.json()) as SeoData;
  data.districts = await fetchDistricts(api);

  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  const template = readFileSync(join(dist, "index.html"), "utf8");
  if (!template.includes('<div id="root"></div>')) throw new Error("[prerender] dist/index.html has no empty #root");

  const pages = allPages(siteUrl, data);
  for (const p of pages) {
    const out = join(dist, fileFor(p.path));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderPage(template, siteUrl, p));
  }
  // index.html is the home page and also the fallback for every other route: only the site entity
  // goes in, no canonical URL (it would be wrong for those other routes)
  const site = `    <script type="application/ld+json">${JSON.stringify(siteJsonLd(siteUrl))}</script>\n  </head>`;
  writeFileSync(join(dist, "index.html"), template.replace("</head>", site));
  // unknown URLs: the app (it shows "not found"), with a real 404 status from `serve`
  writeFileSync(join(dist, "404.html"), template.replace("</head>", `    <meta name="robots" content="noindex" />\n  </head>`));
  const serveJson = join(dist, "serve.json");
  writeFileSync(serveJson, JSON.stringify(prerenderedServeConfig(JSON.parse(readFileSync(serveJson, "utf8"))), null, 2) + "\n");
  console.log(`[prerender] ${pages.length} pages (${data.colleges.length} colleges, ${data.districts.length} districts) written as .html`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
}
