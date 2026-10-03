import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allPages, APP_ONLY_ROUTES, branchPage, collegePage, fileFor, prerenderedServeConfig, renderPage, staticPage, type SeoData,
} from "../scripts/prerender";
import { STATIC_PAGE_META } from "../src/lib/seo";

const SITE = "https://getmecollege.com";
const DATA: SeoData = {
  year: 2026,
  colleges: [
    {
      code: "16006",
      name: "COEP Technological University",
      district: "Pune",
      collegeType: "Government",
      branches: [
        { choiceCode: "1600624210", name: "Computer Science and Engineering", roundI: 150, latest: 170, seatType: "GOPENS", years: [2024, 2025, 2026] },
        { choiceCode: "1600692110", name: "AI & <ML>", roundI: null, latest: 633, seatType: "GOPENO", years: [2026] },
      ],
    },
  ],
};
const TEMPLATE = `<!doctype html><html><head>
    <meta name="description" content="default" />
    <meta property="og:title" content="default" />
    <meta property="og:description" content="default" />
    <title>default</title>
  </head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>`;

describe("prerendered pages (SEO)", () => {
  it("a college page: its own title, description, canonical, structured data and branch table", () => {
    const html = renderPage(TEMPLATE, SITE, collegePage(SITE, 2026, DATA.colleges[0]));
    expect(html).toContain("<title>COEP Technological University — CAP 2026 cutoffs by branch | GetMeCollege</title>");
    expect(html).toContain('<meta name="description" content="Closing merit numbers for 2 branches at COEP Technological University, Pune:');
    expect(html).toContain('<link rel="canonical" href="https://getmecollege.com/colleges/16006" />');
    expect(html).toContain('<meta property="og:url" content="https://getmecollege.com/colleges/16006" />');
    expect(html).toContain('"@type":"CollegeOrUniversity"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('<a href="/colleges/16006/1600624210">Computer Science and Engineering</a></td><td>150</td><td>170</td><td>General open, state level</td>');
    // the app's own script still loads
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
  });

  it("escapes text from the data, in the page and in the structured data", () => {
    const html = renderPage(TEMPLATE, SITE, branchPage(SITE, 2026, DATA.colleges[0], DATA.colleges[0].branches[1]));
    expect(html).toContain("<h1>AI &amp; &lt;ML&gt;, COEP Technological University</h1>");
    expect(html).not.toContain("<ML>");
    expect(html).toContain("\\u003cML>"); // inside JSON-LD a "<" can't close the script
    expect(html).toContain("<dd>–</dd>"); // no Round I closing: a dash, not a made-up number
  });

  it("the colleges list links every college, so crawlers can reach them", () => {
    const html = renderPage(TEMPLATE, SITE, staticPage(SITE, "/colleges", DATA));
    expect(html).toContain('<a href="/colleges/16006">COEP Technological University</a>');
    expect(html).toContain(`<title>${STATIC_PAGE_META["/colleges"].title} | GetMeCollege</title>`);
  });

  it("writes one page per public URL, as <path>.html", () => {
    const paths = allPages(SITE, DATA).map((p) => p.path);
    expect(paths).toEqual(expect.arrayContaining(["/colleges", "/guide", "/colleges/16006", "/colleges/16006/1600624210", "/colleges/16006/1600692110"]));
    expect(paths).not.toContain("/");
    expect(paths).toHaveLength(Object.keys(STATIC_PAGE_META).length - 1 + 1 + 2);
    expect(fileFor("/colleges/16006")).toBe("colleges/16006.html");
  });

  it("serve.json keeps the security headers and sends only app routes to index.html", () => {
    const cfg = prerenderedServeConfig({ headers: [{ source: "**", headers: [] }] });
    expect(cfg.headers).toHaveLength(1);
    expect(cfg.cleanUrls).toBe(true);
    expect(cfg.rewrites.map((r) => r.source)).toEqual(APP_ONLY_ROUTES);
    expect(cfg.rewrites.some((r) => r.source === "**")).toBe(false);
  });

  it("every route in App.tsx is either prerendered or listed as an app-only route", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    const routes = [...app.matchAll(/path="([^"]+)"/g)].map((m) => "/" + m[1]).filter((r) => r !== "/*");
    const prerendered = (r: string) => r in STATIC_PAGE_META || r.startsWith("/colleges/:code");
    const listed = (r: string) => APP_ONLY_ROUTES.some((a) => a === r || (a.endsWith("/**") && r.startsWith(a.slice(0, -3) + "/")));
    for (const r of routes) expect(prerendered(r) || listed(r), r).toBe(true);
  });
});
