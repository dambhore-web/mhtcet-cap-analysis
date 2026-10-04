// Writes dist/robots.txt and dist/sitemap.xml after `vite build` (SEO).
//
// Indexing is allowed only when VITE_SITE_URL is set: the public address, e.g. https://compass.example.
// Without it (local builds, staging, previews) robots.txt blocks every crawler and no sitemap is
// written, so test deployments never end up in search results.
//
// The sitemap lists the public pages plus every college, branch and district page, from the API's
// GET /api/sitemap (SITEMAP_API_URL, else VITE_API_URL). If that call fails while VITE_SITE_URL is
// set, the build fails: a production build without its sitemap should not ship silently.
// Usage: node scripts/write-seo-files.mjs   (from apps/web, after vite build)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Public pages that are the same for everyone. Personal pages carry noindex instead. */
export const STATIC_PATHS = ["/", "/colleges", "/branches", "/guide", "/data", "/estimate", "/eligibility", "/legal"];

const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The URLs to list: static pages, each college and its branches, then the district landing pages. */
export function sitemapPaths(data) {
  const paths = [...STATIC_PATHS];
  for (const c of data.colleges) {
    paths.push(`/colleges/${c.code}`);
    for (const b of c.branches) paths.push(`/colleges/${c.code}/${b}`);
  }
  for (const g of data.branchGroups ?? []) paths.push(`/branches/${g}`);
  const districts = data.districts ?? [];
  if (districts.length) paths.push("/engineering-colleges");
  for (const d of districts) {
    paths.push(`/engineering-colleges/${d.slug}`);
    for (const g of d.groups) paths.push(`/engineering-colleges/${d.slug}/${g}`);
  }
  return paths;
}

export function buildSitemapXml(siteUrl, data) {
  const base = siteUrl.replace(/\/+$/, "");
  const urls = sitemapPaths(data).map((p) => `  <url><loc>${xmlEscape(base + p)}</loc></url>`);
  if (urls.length > 50000) throw new Error(`sitemap has ${urls.length} URLs; split it (limit 50,000)`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export function buildRobots(siteUrl) {
  if (!siteUrl) {
    return "# Not the public site (VITE_SITE_URL unset): keep it out of search.\nUser-agent: *\nDisallow: /\n";
  }
  const base = siteUrl.replace(/\/+$/, "");
  // shared family summaries carry the student's details in the link
  return `User-agent: *\nAllow: /\nDisallow: /summary\n\nSitemap: ${base}/sitemap.xml\n`;
}

async function main() {
  const dist = (name) => fileURLToPath(new URL(`../dist/${name}`, import.meta.url));
  const siteUrl = (process.env.VITE_SITE_URL ?? "").trim();
  if (siteUrl && !/^https:\/\//.test(siteUrl)) throw new Error(`VITE_SITE_URL must be an https:// address: ${siteUrl}`);

  writeFileSync(dist("robots.txt"), buildRobots(siteUrl));
  if (!siteUrl) {
    console.log("[seo] VITE_SITE_URL unset: robots.txt blocks crawlers, no sitemap");
    return;
  }

  const api = (process.env.SITEMAP_API_URL || process.env.VITE_API_URL || "").replace(/\/+$/, "");
  if (!api) throw new Error("[seo] set VITE_API_URL or SITEMAP_API_URL so the sitemap can list colleges and branches");
  const res = await fetch(`${api}/api/sitemap`);
  if (!res.ok) throw new Error(`[seo] ${api}/api/sitemap answered ${res.status}`);
  const data = await res.json();
  const xml = buildSitemapXml(siteUrl, data);
  writeFileSync(dist("sitemap.xml"), xml);
  const count = (xml.match(/<url>/g) ?? []).length;
  console.log(`[seo] sitemap.xml: ${count} URLs (${data.colleges.length} colleges), robots.txt allows crawling`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
