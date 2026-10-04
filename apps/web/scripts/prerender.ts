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
import { fetchApi } from "./fetch-api.mjs";
import { branchGroupMeta, branchMeta, closingPhrase, collegeMeta, fullTitle, type OpenClosing, SITE_NAME, STATIC_PAGE_META, type PageMeta } from "../src/lib/seo.ts";
import { estimateFaqs, formatPercentile, percentileRows, type ScalePoint } from "../src/lib/percentile.ts";
import { CAP_STEPS, DECISIONS, FAQS } from "../src/lib/guide.ts";
import { BRANCH_GROUP_HUB, branchGroupPath } from "../src/lib/branchGroups.ts";
import { seatTypeLabel } from "../src/lib/seatType.ts";
import {
  collegeRows, DISTRICT_HUB_PATH, districtIntro, districtLabel, districtMeta, districtPath, formatLakh, groupIntro, groupMeta,
  groupPath, groupRows, hubMeta, noFeeText, SOURCES_NOTE, type DistrictCollege, type DistrictDetail,
} from "../src/lib/districts.ts";

export interface SeoBranch {
  choiceCode: string;
  name: string;
  /** Branch group (Computer & IT …), null when the branch is in none (GET /api/seo-pages). */
  group?: string | null;
  roundI: number | null;
  latest: number;
  seatType: string;
  years: number[];
  /** The same rows' closing percentiles (GET /api/seo-pages; absent in older API builds). */
  roundIPct?: number | null;
  latestPct?: number | null;
  /** CAP seats from the seat matrix. */
  intake?: number | null;
  /** Earlier years of the same open seat type, oldest first. */
  past?: { year: number; roundI: number | null; latest: number }[];
  /** Round I closing per category seat type (MH list), plus EWS and TFWS. */
  seatTypes?: { seatType: string; roundI: number; percentile: number | null }[];
  /** All India seats, Round I. */
  allIndia?: { roundI: number; percentile: number | null } | null;
}
export interface SeoCollege {
  code: string;
  name: string;
  district: string | null;
  collegeType: string | null;
  homeUniversity?: string | null;
  intake?: number | null;
  branches: SeoBranch[];
}
export interface SeoData {
  year: number;
  colleges: SeoCollege[];
  /** District landing pages, from GET /api/districts/:slug for each district. */
  districts?: DistrictDetail[];
  /** Merit ↔ percentile pairs of the year (GET /api/percentile-scale), for the /estimate tables. */
  scales?: { year: number; mh: ScalePoint[]; ai: ScalePoint[] };
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

/** What a college and branch page links to: its district page, fees, salaries and neighbours. */
export interface PageContext {
  district: DistrictDetail;
  college: DistrictCollege;
}

/** Each college's district page entry, for links, fees and salaries (from the district data). */
export function contextIndex(districts: DistrictDetail[] = []): Map<string, PageContext> {
  const index = new Map<string, PageContext>();
  for (const d of districts) for (const c of d.colleges) index.set(c.code, { district: d, college: c });
  return index;
}

const closingOf = (b: { roundI: number | null; latest: number }) => b.roundI ?? b.latest;
const pct = (p: number | null | undefined) => (p == null ? "" : ` (${formatPercentile(p)} percentile)`);
const openOf = (year: number, b: SeoBranch): OpenClosing => ({ year, roundI: b.roundI, roundIPct: b.roundIPct ?? null, latest: b.latest });

/**
 * A question list plus the matching FAQPage structured data. Pages whose app view doesn't show the
 * questions (college, branch, branch group) use only the html: structured data must describe what
 * visitors see.
 */
function faq(items: { q: string; a: string }[]): { html: string; jsonLd: object | null } {
  if (!items.length) return { html: "", jsonLd: null };
  return {
    html: `<h2>Questions</h2>${items.map((it) => `<h3>${esc(it.q)}</h3><p>${esc(it.a)}</p>`).join("")}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })),
    },
  };
}

/** "got harder: the Round I closing fell from 243 (2025) to 150 (2026)"; lower merit numbers are harder to get. */
export function trendSentence(branch: string, year: number, b: SeoBranch): string | null {
  const before = [...(b.past ?? [])].reverse().find((p) => p.roundI != null);
  if (!before || b.roundI == null || before.roundI === b.roundI) return null;
  const harder = b.roundI < before.roundI!;
  return (
    `${branch} got ${harder ? "harder" : "easier"} to get on open seats: the Round I closing merit number ${harder ? "fell" : "rose"} ` +
    `from ${num(before.roundI)} in ${before.year} to ${num(b.roundI)} in ${year} (a lower number is harder to get).`
  );
}

/** Other branches of the same group in the district, nearest closing first: links to similar options. */
function similarInDistrict(ctx: PageContext | undefined, b: SeoBranch, collegeCode: string, limit = 5) {
  if (!ctx) return [];
  const mine = ctx.college.branches.find((x) => x.choiceCode === b.choiceCode);
  if (!mine?.group) return [];
  const target = closingOf(b);
  return ctx.district.colleges
    .filter((c) => c.code !== collegeCode)
    .flatMap((c) => c.branches.filter((x) => x.group === mine.group).map((x) => ({ college: c, branch: x })))
    .sort((p, q) => Math.abs(closingOf(p.branch) - target) - Math.abs(closingOf(q.branch) - target))
    .slice(0, limit);
}

/** The colleges in the district whose hardest branch closed nearest this college's. */
function nearbyColleges(ctx: PageContext | undefined, c: SeoCollege, limit = 5) {
  if (!ctx || !c.branches.length) return [];
  const best = (bs: { roundI: number | null; latest: number }[]) => Math.min(...bs.map(closingOf));
  const target = best(c.branches);
  return ctx.district.colleges
    .filter((o) => o.code !== c.code && o.branches.length)
    .sort((p, q) => Math.abs(best(p.branches) - target) - Math.abs(best(q.branches) - target))
    .slice(0, limit);
}

const feeText = (ctx?: PageContext) => (ctx?.college.fee ? `₹${ctx.college.fee.total.toLocaleString("en-IN")} a year (FRA-approved, ${ctx.college.fee.year})` : null);
const salaryText = (ctx?: PageContext) =>
  ctx?.college.placement ? `${formatLakh(ctx.college.placement.medianSalary)} median salary (NIRF, batch ${ctx.college.placement.graduationYear})` : null;

function crumbHtml(items: { name: string; path?: string }[]) {
  return `<nav aria-label="Breadcrumb">${items.map((it) => (it.path ? `<a href="${it.path}">${esc(it.name)}</a>` : esc(it.name))).join(" / ")}</nav>`;
}

function crumbItems(ctx: PageContext | undefined) {
  return [{ name: "Colleges", path: "/colleges" }, ...(ctx ? [{ name: districtLabel(ctx.district.name), path: districtPath(ctx.district.slug) }] : [])];
}

export function collegePage(siteUrl: string, year: number, c: SeoCollege, ctx?: PageContext): Page {
  const path = `/colleges/${c.code}`;
  const top = c.branches.length ? c.branches.reduce((a, b) => (closingOf(b) < closingOf(a) ? b : a)) : null;
  const meta = collegeMeta(c, c.branches.length, year, top ? { branch: top.name, closing: openOf(year, top) } : null);
  const place = ctx ? districtLabel(ctx.district.name) : c.district ? districtLabel(c.district) : null;
  const prevYear = (b: SeoBranch) => b.past?.at(-1);
  const rows = c.branches
    .map((b) => {
      const prev = prevYear(b);
      return (
        `<tr><td><a href="${path}/${b.choiceCode}">${esc(b.name)}</a></td><td>${num(b.roundI)}${pct(b.roundIPct)}</td><td>${num(b.latest)}</td>` +
        `<td>${prev ? `${num(prev.latest)} (${prev.year})` : "–"}</td><td>${b.intake ?? "–"}</td><td>${esc(seatTypeLabel(b.seatType))}</td></tr>`
      );
    })
    .join("");
  const facts = [
    c.collegeType ? `<dt>Type</dt><dd>${esc(c.collegeType)}</dd>` : "",
    place ? `<dt>District</dt><dd>${ctx ? `<a href="${districtPath(ctx.district.slug)}">${esc(place)}</a>` : esc(place)}</dd>` : "",
    c.homeUniversity ? `<dt>Home university</dt><dd>${esc(c.homeUniversity)}</dd>` : "",
    `<dt>Branches in CAP ${year}</dt><dd>${c.branches.length}</dd>`,
    c.intake ? `<dt>CAP seats</dt><dd>${num(c.intake)}</dd>` : "",
    feeText(ctx) ? `<dt>Fee</dt><dd>${esc(feeText(ctx)!)}</dd>` : "",
    salaryText(ctx) ? `<dt>Placements</dt><dd>${esc(salaryText(ctx)!)}</dd>` : "",
  ].join("");
  const lead =
    `${c.name}${place && !c.name.toLowerCase().includes(place.toLowerCase().split(" ")[0]) ? `, ${place},` : ""} took part in MHT-CET CAP ${year} with ` +
    `${c.branches.length} ${c.branches.length === 1 ? "branch" : "branches"}${c.intake ? ` and ${num(c.intake)} CAP seats` : ""}.` +
    (top ? ` The hardest to get was ${top.name}, which ${closingPhrase(openOf(year, top))}.` : "");
  const hardest = [...c.branches].sort((a, b) => closingOf(a) - closingOf(b)).slice(0, 3);
  const questions = faq([
    ...(hardest.length
      ? [{
          q: `What is the cutoff of ${c.name} in CAP ${year}?`,
          a: `On open seats in Round I: ${hardest.map((b) => `${b.name} ${num(closingOf(b))}${b.roundIPct != null && b.roundI != null ? ` (${formatPercentile(b.roundIPct)} percentile)` : ""}`).join("; ")}. Each branch and seat type has its own closing merit number; the table above lists them all.`,
        }]
      : []),
    ...(feeText(ctx) ? [{ q: `What is the fee at ${c.name}?`, a: `${feeText(ctx)}, from the Fee Regulating Authority's approved fees.` }] : []),
    ...(salaryText(ctx) ? [{ q: `What are placements like at ${c.name}?`, a: `${salaryText(ctx)}, as reported by the college to NIRF.` }] : []),
  ]);
  const nearby = nearbyColleges(ctx, c);
  const groups = ctx
    ? ctx.district.groups.filter((g) => ctx.college.branches.some((b) => b.group === g.name))
    : [];
  const body =
    `<main class="page prerendered">${crumbHtml(crumbItems(ctx))}` +
    `<h1>${esc(c.name)} cutoff ${year}</h1><p>${esc(lead)}</p><dl>${facts}</dl>` +
    `<table><caption>CAP ${year} closing merit numbers, open seats</caption><thead><tr><th>Branch</th><th>Round I</th><th>Last round</th><th>Year before, last round</th><th>Seats</th><th>Seat type</th></tr></thead><tbody>${rows}</tbody></table>` +
    questions.html +
    (groups.length && ctx
      ? `<h2>Compare in ${esc(districtLabel(ctx.district.name))}</h2><ul>${groups.map((g) => `<li><a href="${groupPath(ctx.district.slug, g.slug)}">${esc(g.name)} engineering colleges in ${esc(districtLabel(ctx.district.name))}</a></li>`).join("")}</ul>`
      : "") +
    (nearby.length ? `<h2>Colleges with similar cutoffs nearby</h2><ul>${nearby.map((o) => `<li><a href="/colleges/${o.code}">${esc(o.name)}</a></li>`).join("")}</ul>` : "") +
    `${NOTE}</main>`;
  return {
    path,
    meta,
    body,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebPage", name: fullTitle(meta.title), url: siteUrl + path, about: collegeEntity(c) },
      breadcrumb(siteUrl, [...crumbItems(ctx), { name: c.name, path }]),
    ],
  };
}

export function branchPage(siteUrl: string, year: number, c: SeoCollege, b: SeoBranch, ctx?: PageContext): Page {
  const path = `/colleges/${c.code}/${b.choiceCode}`;
  const open = openOf(year, b);
  const meta = branchMeta(c.name, b.name, b.years, open);
  const lead = `${b.name} at ${c.name} ${closingPhrase(open)}.`;
  const trend = trendSentence(b.name, year, b);
  const facts = [
    `<dt>CAP ${year}, Round I closing</dt><dd>${num(b.roundI)}${pct(b.roundIPct)}</dd>`,
    `<dt>CAP ${year}, last round closing</dt><dd>${num(b.latest)}${pct(b.latestPct)}</dd>`,
    `<dt>Seat type</dt><dd>${esc(seatTypeLabel(b.seatType))}</dd>`,
    b.intake ? `<dt>CAP seats</dt><dd>${b.intake}</dd>` : "",
    b.allIndia ? `<dt>All India seats, Round I closing</dt><dd>All India merit ${num(b.allIndia.roundI)}${b.allIndia.percentile != null ? ` (JEE Main ${formatPercentile(b.allIndia.percentile)} percentile)` : ""}</dd>` : "",
    feeText(ctx) ? `<dt>Fee</dt><dd>${esc(feeText(ctx)!)}</dd>` : "",
    salaryText(ctx) ? `<dt>College placements</dt><dd>${esc(salaryText(ctx)!)}</dd>` : "",
    `<dt>Years of data</dt><dd>${b.years.join(", ")}</dd><dt>Choice code</dt><dd>${esc(b.choiceCode)}</dd>`,
  ].join("");
  const cats = b.seatTypes ?? [];
  const catTable = cats.length
    ? `<table><caption>CAP ${year} Round I closing by seat type</caption><thead><tr><th>Seat type</th><th>Closing merit number</th><th>Percentile</th></tr></thead><tbody>` +
      cats.map((s) => `<tr><td>${esc(seatTypeLabel(s.seatType))}</td><td>${num(s.roundI)}</td><td>${s.percentile != null ? formatPercentile(s.percentile) : "–"}</td></tr>`).join("") +
      `</tbody></table>`
    : "";
  const years = [...(b.past ?? []), { year, roundI: b.roundI, latest: b.latest }];
  const yearTable =
    years.length > 1
      ? `<table><caption>Open seats year by year</caption><thead><tr><th>CAP year</th><th>Round I</th><th>Last round</th></tr></thead><tbody>` +
        years.map((y) => `<tr><td>${y.year}</td><td>${num(y.roundI)}</td><td>${num(y.latest)}</td></tr>`).join("") +
        `</tbody></table>`
      : "";
  const catLine = cats
    .filter((s) => s.seatType !== b.seatType)
    .slice(0, 6)
    .map((s) => `${seatTypeLabel(s.seatType)} ${num(s.roundI)}`)
    .join("; ");
  const questions = faq([
    { q: `What was the ${b.name} cutoff at ${c.name} in CAP ${year}?`, a: `It ${closingPhrase(open)}.` },
    ...(catLine ? [{ q: `What were the category cutoffs (OBC, SC, ST, EWS, TFWS)?`, a: `Round I closing merit numbers in CAP ${year}: ${catLine}.` }] : []),
    ...(b.allIndia
      ? [{
          q: `What was the All India (JEE Main) cutoff?`,
          a: `All India seats closed at All India merit ${num(b.allIndia.roundI)}${b.allIndia.percentile != null ? `, JEE Main ${formatPercentile(b.allIndia.percentile)} percentile` : ""}, in Round I of CAP ${year}.`,
        }]
      : []),
    ...(b.intake ? [{ q: `How many CAP seats does ${b.name} at ${c.name} have?`, a: `${b.intake} seats in the CAP ${year} seat matrix, across all seat types.` }] : []),
  ]);
  const siblings = c.branches.filter((x) => x.choiceCode !== b.choiceCode);
  const similar = similarInDistrict(ctx, b, c.code);
  const mine = ctx?.college.branches.find((x) => x.choiceCode === b.choiceCode);
  const group = mine?.group && ctx ? ctx.district.groups.find((g) => g.name === mine.group) : undefined;
  const body =
    `<main class="page prerendered">${crumbHtml([...crumbItems(ctx), { name: c.name, path: `/colleges/${c.code}` }])}` +
    `<h1>${esc(b.name)} cutoff, ${esc(c.name)}</h1><p>${esc(lead)}${trend ? ` ${esc(trend)}` : ""}</p><dl>${facts}</dl>` +
    catTable +
    yearTable +
    questions.html +
    (similar.length
      ? `<h2>Similar cutoffs nearby</h2><ul>${similar.map(({ college: o, branch: x }) => `<li><a href="/colleges/${o.code}/${x.choiceCode}">${esc(x.name)}, ${esc(o.name)}</a>: ${num(closingOf(x))}</li>`).join("")}</ul>`
      : "") +
    (group && ctx ? `<p><a href="${groupPath(ctx.district.slug, group.slug)}">${esc(group.name)} engineering colleges in ${esc(districtLabel(ctx.district.name))}</a></p>` : "") +
    (siblings.length
      ? `<h2>Other branches at ${esc(c.name)}</h2><ul>${siblings.map((x) => `<li><a href="/colleges/${c.code}/${x.choiceCode}">${esc(x.name)}</a>: ${num(closingOf(x))}</li>`).join("")}</ul>`
      : "") +
    `${NOTE}</main>`;
  return {
    path,
    meta,
    body,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebPage", name: fullTitle(meta.title), url: siteUrl + path, about: collegeEntity(c) },
      breadcrumb(siteUrl, [...crumbItems(ctx), { name: c.name, path: `/colleges/${c.code}` }, { name: b.name, path }]),
    ],
  };
}

/** /guide: every section of the CAP guide (the page shows them as tabs), with its questions as FAQPage data. */
export function guidePage(siteUrl: string): Page {
  const meta = STATIC_PAGE_META["/guide"];
  const questions = faq(FAQS);
  const body =
    `<main class="page prerendered"><h1>${esc(meta.title)}</h1><p>${esc(meta.description ?? "")}</p>` +
    `<h2>How CAP works</h2><ol>${CAP_STEPS.map((st) => `<li><strong>${esc(st.title)}.</strong> ${esc(st.body)}</li>`).join("")}</ol>` +
    `<h2>Freeze, float or slide</h2>${DECISIONS.map((d) => `<h3>${esc(d.title)}</h3><p>${esc(d.summary)}</p>`).join("")}` +
    `<h2>Seat codes</h2><p>Most seat codes join three parts: who the seat is for (G general, L ladies, DEF defence, PWD disability), the category (OPEN, OBC, SEBC, SC, ST, VJ, NT1, NT2, NT3) and the level (S state, H home university, O other than home university). For example GOPENH is general, open category, home university. <a href="/eligibility">Which seat types can I take?</a></p>` +
    questions.html +
    `<p><a href="/estimate">MHT-CET percentile to merit number</a> · <a href="/colleges">All colleges</a> · <a href="/branches">Cutoffs by branch</a></p>` +
    `<p>Dates and rules change every year. Always follow the official CAP information brochure and CET Cell notices.</p></main>`;
  return {
    path: "/guide",
    meta,
    body,
    jsonLd: [{ "@context": "https://schema.org", "@type": "WebPage", name: fullTitle(meta.title), url: siteUrl + "/guide" }, ...(questions.jsonLd ? [questions.jsonLd] : [])],
  };
}

/** /estimate: the percentile → merit number tables the page shows, with questions as FAQPage data. */
export function estimatePage(siteUrl: string, scales: NonNullable<SeoData["scales"]>): Page {
  const meta = STATIC_PAGE_META["/estimate"];
  const mh = percentileRows(scales.mh);
  const ai = percentileRows(scales.ai);
  const table = (rows: typeof mh, a: string, b: string, caption: string) =>
    `<table><caption>${esc(caption)}</caption><thead><tr><th>${a}</th><th>${b}</th></tr></thead><tbody>` +
    rows.map((r) => `<tr><td>${r.percentile}</td><td>${num(r.merit)}</td></tr>`).join("") +
    `</tbody></table>`;
  const questions = faq(estimateFaqs(scales.year, mh, ai));
  const body =
    `<main class="page prerendered"><h1>MHT-CET percentile vs merit number, CAP ${scales.year}</h1><p>${esc(meta.description ?? "")}</p>` +
    (mh.length ? table(mh, "MHT-CET percentile", "State merit number (about)", `CAP ${scales.year}: MHT-CET percentile and state merit number (PCM), from the official cutoff lists`) : "") +
    (ai.length ? `<h2>JEE Main percentile vs All India merit number</h2>` + table(ai, "JEE Main percentile", "All India merit number (about)", `CAP ${scales.year}: JEE Main percentile and All India merit number`) : "") +
    questions.html +
    `<p><a href="/find">Find colleges by percentile or merit number</a> · <a href="/guide">How CAP works</a> · <a href="/colleges">All colleges</a></p>${NOTE}</main>`;
  return {
    path: "/estimate",
    meta,
    body,
    jsonLd: [{ "@context": "https://schema.org", "@type": "WebPage", name: fullTitle(meta.title), url: siteUrl + "/estimate" }, ...(questions.jsonLd ? [questions.jsonLd] : [])],
  };
}

/** The branch groups that have pages, in the data's order of first appearance. */
export function branchGroups(data: SeoData): string[] {
  return [...new Set(data.colleges.flatMap((c) => c.branches.flatMap((b) => (b.group ? [b.group] : []))))];
}

/** /branches/computer-it: every college offering the group across Maharashtra, hardest to get first. */
export function branchGroupPage(siteUrl: string, data: SeoData, group: string): Page {
  const path = branchGroupPath(group);
  const meta = branchGroupMeta(group);
  const ctx = contextIndex(data.districts);
  const rows = data.colleges
    .flatMap((c) => c.branches.filter((b) => b.group === group).map((b) => ({ c, b })))
    .sort((p, q) => closingOf(p.b) - closingOf(q.b));
  const colleges = new Set(rows.map((r) => r.c.code));
  const seats = rows.reduce((n, r) => n + (r.b.intake ?? 0), 0);
  const top = rows[0];
  const lead =
    `${num(colleges.size)} colleges offered ${num(rows.length)} ${group} ${rows.length === 1 ? "branch" : "branches"} in MHT-CET CAP ${data.year}` +
    `${seats ? `, with ${num(seats)} CAP seats` : ""}.` +
    (top ? ` The hardest to get on open seats was ${top.b.name} at ${top.c.name}, which ${closingPhrase(openOf(data.year, top.b))}.` : "");
  const table =
    `<table><caption>CAP ${data.year}: ${esc(group)} branches by open-seat closing merit number, lowest first</caption>` +
    `<thead><tr><th>College and branch</th><th>District</th><th>Round I</th><th>Last round</th></tr></thead><tbody>` +
    rows
      .map(({ c, b }) => {
        const d = ctx.get(c.code)?.district;
        return (
          `<tr><td><a href="/colleges/${c.code}">${esc(c.name)}</a>: <a href="/colleges/${c.code}/${b.choiceCode}">${esc(b.name)}</a></td>` +
          `<td>${d ? `<a href="${districtPath(d.slug)}">${esc(districtLabel(d.name))}</a>` : esc(c.district ?? "–")}</td><td>${num(b.roundI)}</td><td>${num(b.latest)}</td></tr>`
        );
      })
      .join("") +
    `</tbody></table>`;
  const byDistrict = (data.districts ?? [])
    .flatMap((d) => d.groups.filter((g) => g.name === group).map((g) => ({ d, g })))
    .sort((p, q) => q.g.colleges - p.g.colleges)
    .map(({ d, g }) => `<li><a href="${groupPath(d.slug, g.slug)}">${esc(group)} engineering colleges in ${esc(districtLabel(d.name))}</a> (${g.colleges})</li>`)
    .join("");
  const top5 = rows.slice(0, 5);
  const questions = faq([
    ...(top5.length
      ? [{
          q: `Which colleges had the lowest ${group} cutoff in Maharashtra in CAP ${data.year}?`,
          a: `On open seats in Round I: ${top5.map(({ c, b }) => `${c.name} (${b.name}) ${num(closingOf(b))}`).join("; ")}. A lower merit number is harder to get.`,
        }]
      : []),
    { q: `How many colleges offer ${group} in MHT-CET CAP?`, a: `${num(colleges.size)} colleges with ${num(rows.length)} ${group} branches took part in CAP ${data.year}${seats ? `, with ${num(seats)} CAP seats` : ""}.` },
  ]);
  const others = branchGroups(data).filter((g) => g !== group).map((g) => `<a href="${branchGroupPath(g)}">${esc(g)}</a>`).join(" · ");
  return {
    path,
    meta,
    body:
      `<main class="page prerendered"><nav aria-label="Breadcrumb"><a href="${BRANCH_GROUP_HUB}">Branches</a></nav>` +
      `<h1>${esc(group)} engineering colleges in Maharashtra</h1><p>${esc(lead)}</p>` +
      (byDistrict ? `<h2>By district</h2><ul>${byDistrict}</ul>` : "") +
      table +
      questions.html +
      (others ? `<p>Other branches: ${others}</p>` : "") +
      `${NOTE}</main>`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: fullTitle(meta.title),
        url: siteUrl + path,
        mainEntity: {
          "@type": "ItemList",
          name: meta.title,
          itemListElement: rows.slice(0, 50).map(({ c, b }, i) => ({ "@type": "ListItem", position: i + 1, name: `${b.name}, ${c.name}`, url: `${siteUrl}/colleges/${c.code}/${b.choiceCode}` })),
        },
      },
      breadcrumb(siteUrl, [{ name: "Branches", path: BRANCH_GROUP_HUB }, { name: group, path }]),
    ],
  };
}

export function staticPage(siteUrl: string, path: string, data: SeoData): Page {
  if (path === "/guide") return guidePage(siteUrl);
  if (path === "/estimate" && data.scales) return estimatePage(siteUrl, data.scales);
  const meta = STATIC_PAGE_META[path];
  // the colleges list doubles as a crawl path to every college page
  const list =
    path === "/colleges"
      ? `<ul>${data.colleges.map((c) => `<li><a href="/colleges/${c.code}">${esc(c.name)}</a></li>`).join("")}</ul>`
      : path === BRANCH_GROUP_HUB
        ? `<ul>${branchGroups(data).map((g) => `<li><a href="${branchGroupPath(g)}">${esc(g)} engineering colleges in Maharashtra</a></li>`).join("")}</ul>`
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

/** How many colleges the home page names as the most sought after in the latest year. */
export const HOME_TOP_COLLEGES = 20;
/** Districts whose Computer & IT pages the home page links, largest first. */
const HOME_GROUP_DISTRICTS = 6;

/**
 * The home page: what the site covers, how it works, and links into every district and the most
 * sought-after colleges, so a crawler's first page leads everywhere. The app replaces it on start.
 */
export function homePage(siteUrl: string, data: SeoData): Page {
  const meta = STATIC_PAGE_META["/"];
  const districts = data.districts ?? [];
  const branches = data.colleges.reduce((n, c) => n + c.branches.length, 0);
  const years = [...new Set(data.colleges.flatMap((c) => c.branches.flatMap((b) => b.years)))].sort();
  const span = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(data.year);
  // a college's lowest open-seat closing in the latest year: Round I, else the last round
  const lowest = (c: SeoCollege) => Math.min(...c.branches.map((b) => b.roundI ?? b.latest));
  const top = data.colleges
    .filter((c) => c.branches.length)
    .map((c) => ({ c, closing: lowest(c) }))
    .sort((a, b) => a.closing - b.closing)
    .slice(0, HOME_TOP_COLLEGES);
  const topItems = top
    .map(({ c, closing }) => `<li><a href="/colleges/${c.code}">${esc(c.name)}</a>${c.district ? `, ${esc(districtLabel(c.district))}` : ""}: from ${num(closing)}</li>`)
    .join("");
  const districtItems = [...districts]
    .sort((a, b) => b.colleges.length - a.colleges.length)
    .map((d) => `<li><a href="${districtPath(d.slug)}">Engineering colleges in ${esc(districtLabel(d.name))}</a> (${d.colleges.length})</li>`)
    .join("");
  const computer = [...districts]
    .sort((a, b) => b.colleges.length - a.colleges.length)
    .flatMap((d) => {
      const g = d.groups.find((x) => x.slug === "computer-it");
      return g ? [`<a href="${groupPath(d.slug, g.slug)}">${esc(g.name)} colleges in ${esc(districtLabel(d.name))}</a>`] : [];
    })
    .slice(0, HOME_GROUP_DISTRICTS)
    .join(" · ");
  const body =
    `<main class="page prerendered">` +
    `<h1>MHT-CET CAP cutoffs for every Maharashtra engineering college and branch</h1>` +
    `<p>${esc(meta.description ?? "")} ${num(data.colleges.length)} colleges and ${num(branches)} branches, CAP ${span}. ` +
    `Put in your MHT-CET merit number or percentile (or your JEE Main percentile for All India seats) and see which colleges and branches took a student like you last year, and in which round.</p>` +
    `<h2>How it works</h2><ol>` +
    `<li>Your merit number, or your percentile if the merit list isn't out yet.</li>` +
    `<li>Your seat details: category, gender, home university and special seats decide which seats you can take.</li>` +
    `<li>Colleges by chance: where a student like you got a seat last year, and in which round.</li>` +
    `<li>Your option form: order your choices, test them in the simulator, export for the CAP portal.</li></ol>` +
    `<p><a href="/estimate">MHT-CET percentile to merit number</a> · <a href="/guide">How CAP works: rounds, seat codes, freeze, float, slide</a> · ` +
    `<a href="/colleges">All colleges</a> · <a href="/branches">Cutoffs by branch</a> · <a href="/data">Where the numbers come from</a></p>` +
    (top.length
      ? `<h2>Most sought-after engineering colleges, CAP ${data.year}</h2><p>Lowest closing merit number on open seats, any branch.</p><ol>${topItems}</ol>`
      : "") +
    (branchGroups(data).length
      ? `<h2>Cutoffs by branch</h2><p>${branchGroups(data).map((g) => `<a href="${branchGroupPath(g)}">${esc(g)}</a>`).join(" · ")}</p>`
      : "") +
    (computer ? `<h2>Computer engineering colleges</h2><p>${computer}</p>` : "") +
    (districtItems ? `<h2>Engineering colleges by district</h2><ul>${districtItems}</ul>` : "") +
    `${NOTE}</main>`;
  return {
    path: "/",
    meta,
    body,
    jsonLd: [siteJsonLd(siteUrl), { "@context": "https://schema.org", "@type": "WebPage", name: fullTitle(meta.title), url: siteUrl + "/" }],
  };
}

/** The share image every page uses (public/og-image.png, 1200 × 630). */
export const OG_IMAGE = { path: "/og-image.png", width: 1200, height: 630, alt: "GetMeCollege: MHT-CET CAP cutoffs for every Maharashtra engineering college" };

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
    `    <meta property="og:image" content="${esc(siteUrl + OG_IMAGE.path)}" />\n` +
    `    <meta property="og:image:width" content="${OG_IMAGE.width}" />\n    <meta property="og:image:height" content="${OG_IMAGE.height}" />\n` +
    `    <meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}" />\n    <meta name="twitter:image" content="${esc(siteUrl + OG_IMAGE.path)}" />\n` +
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
  const ctx = contextIndex(data.districts);
  for (const c of data.colleges) {
    pages.push(collegePage(siteUrl, data.year, c, ctx.get(c.code)));
    for (const b of c.branches) pages.push(branchPage(siteUrl, data.year, c, b, ctx.get(c.code)));
  }
  for (const g of branchGroups(data)) pages.push(branchGroupPage(siteUrl, data, g));
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

/**
 * The app shell without any page's content (written by the web build next to index.html). App-only
 * routes and the service worker's page-load fallback use it; index.html becomes the home page.
 */
export const APP_SHELL = "app.html";

/** serve.json once per-page HTML exists: app-only routes to the app shell, the rest from files. */
export function prerenderedServeConfig(existing: { headers?: unknown[] }) {
  return {
    ...existing,
    cleanUrls: true,
    rewrites: APP_ONLY_ROUTES.map((source) => ({ source, destination: `/${APP_SHELL}` })),
  };
}

/** Every district's detail, for the district landing pages. A failed call fails the build. */
async function fetchDistricts(api: string): Promise<DistrictDetail[]> {
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetchApi(`${api}${path}`);
    if (!res.ok) throw new Error(`[prerender] ${api}${path} answered ${res.status}`);
    return (await res.json()) as T;
  };
  const { districts } = await get<{ districts: { slug: string }[] }>("/api/districts");
  return Promise.all(districts.map((d) => get<DistrictDetail>(`/api/districts/${encodeURIComponent(d.slug)}`)));
}

/** The year's merit ↔ percentile pairs for both lists. A failed call fails the build. */
async function fetchScales(api: string): Promise<NonNullable<SeoData["scales"]>> {
  const get = async (list: "MH" | "AI") => {
    const res = await fetchApi(`${api}/api/percentile-scale?list=${list}`);
    if (!res.ok) throw new Error(`[prerender] ${api}/api/percentile-scale?list=${list} answered ${res.status}`);
    return (await res.json()) as { year: number; points: ScalePoint[] };
  };
  const [mh, ai] = await Promise.all([get("MH"), get("AI")]);
  return { year: mh.year, mh: mh.points, ai: ai.points };
}

async function main() {
  const siteUrl = (process.env.VITE_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!siteUrl) {
    console.log("[prerender] VITE_SITE_URL unset: no per-page HTML (the site is not public)");
    return;
  }
  const api = (process.env.SITEMAP_API_URL || process.env.VITE_API_URL || "").replace(/\/+$/, "");
  if (!api) throw new Error("[prerender] set VITE_API_URL or SITEMAP_API_URL");
  const res = await fetchApi(`${api}/api/seo-pages`);
  if (!res.ok) throw new Error(`[prerender] ${api}/api/seo-pages answered ${res.status}`);
  const data = (await res.json()) as SeoData;
  data.districts = await fetchDistricts(api);
  data.scales = await fetchScales(api);

  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  const template = readFileSync(join(dist, APP_SHELL), "utf8");
  if (!template.includes('<div id="root"></div>')) throw new Error(`[prerender] dist/${APP_SHELL} has no empty #root`);

  const pages = allPages(siteUrl, data);
  for (const p of pages) {
    const out = join(dist, fileFor(p.path));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderPage(template, siteUrl, p));
  }
  // index.html is the home page; app-only routes are served the empty shell (app.html) instead
  writeFileSync(join(dist, "index.html"), renderPage(template, siteUrl, homePage(siteUrl, data)));
  // unknown URLs: the app (it shows "not found"), with a real 404 status from `serve`
  writeFileSync(join(dist, "404.html"), template.replace("</head>", `    <meta name="robots" content="noindex" />\n  </head>`));
  const serveJson = join(dist, "serve.json");
  writeFileSync(serveJson, JSON.stringify(prerenderedServeConfig(JSON.parse(readFileSync(serveJson, "utf8"))), null, 2) + "\n");
  console.log(`[prerender] home + ${pages.length} pages (${data.colleges.length} colleges, ${data.districts.length} districts) written as .html`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
}
