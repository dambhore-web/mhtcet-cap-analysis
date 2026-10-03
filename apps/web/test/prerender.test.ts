import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allPages, APP_ONLY_ROUTES, branchPage, collegePage, districtGroupPage, districtPage, fileFor, hubPage, prerenderedServeConfig, renderPage,
  staticPage, type SeoData,
} from "../scripts/prerender";
import { STATIC_PAGE_META } from "../src/lib/seo";
import { DISTRICT_HUB_PATH, type DistrictDetail } from "../src/lib/districts";

const PUNE: DistrictDetail = {
  year: 2026,
  slug: "pune",
  name: "Pune",
  groups: [{ slug: "computer-it", name: "Computer & IT", colleges: 2 }],
  colleges: [
    {
      code: "16006", name: "COEP Technological University", collegeType: "Government", fee: null,
      placement: { medianSalary: 1200000, graduationYear: "2024-25" },
      branches: [
        { choiceCode: "1600624210", name: "Computer Engineering", group: "Computer & IT", roundI: 150, latest: 170, seatType: "GOPENS" },
        { choiceCode: "1600661210", name: "Mechanical Engineering", group: "Mechanical", roundI: 2100, latest: 2500, seatType: "GOPENS" },
      ],
    },
    {
      code: "06271", name: "Pune Institute of <Computer> Technology", collegeType: "Un-Aided", fee: { total: 145000, year: "2026-27" }, placement: null,
      branches: [{ choiceCode: "0627124210", name: "Computer Engineering", group: "Computer & IT", roundI: null, latest: 900, seatType: "GOPENO" }],
    },
  ],
};
const WASHIM: DistrictDetail = { ...PUNE, slug: "washim", name: "Washim", groups: [], colleges: [{ ...PUNE.colleges[1], code: "09999", name: "Washim College" }] };

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

  it("a district page: its own title, the colleges table, group links and official figures only", () => {
    const html = renderPage(TEMPLATE, SITE, districtPage(SITE, PUNE, [PUNE, WASHIM]));
    expect(html).toContain("<title>Engineering colleges in Pune — CAP 2026 cutoffs, fees | GetMeCollege</title>");
    expect(html).toContain('<link rel="canonical" href="https://getmecollege.com/engineering-colleges/pune" />');
    expect(html).toContain("<h1>Engineering colleges in Pune</h1>");
    expect(html).toContain('<a href="/engineering-colleges/pune/computer-it">Computer &amp; IT engineering colleges in Pune</a>');
    // COEP first (150), its fee set by the state, its NIRF median shown
    expect(html).toMatch(/COEP Technological University<\/a> \(Government\)<\/td><td>150, .*<td>Set by the state<\/td><td>₹12 lakh \(NIRF, batch 2024-25\)<\/td>/);
    expect(html).toContain("<td>₹1,45,000 (FRA, 2026-27)</td><td>Not published</td>");
    expect(html).toContain("Pune Institute of &lt;Computer&gt; Technology");
    expect(html).toContain('<a href="/engineering-colleges/washim">Washim</a>');
    expect(html).toContain('"@type":"CollectionPage"');
  });

  it("a district + branch-group page lists only that group's branches", () => {
    const page = districtGroupPage(SITE, PUNE, "computer-it", [PUNE, WASHIM])!;
    expect(page.path).toBe("/engineering-colleges/pune/computer-it");
    expect(page.meta.title).toBe("Computer & IT engineering colleges in Pune — CAP 2026 cutoffs");
    expect(page.body).toContain("Computer Engineering");
    expect(page.body).not.toContain("Mechanical Engineering");
    expect(page.body).toContain("<td>–</td><td>900</td>"); // no Round I: a dash
    expect(districtGroupPage(SITE, PUNE, "mechanical", [PUNE])).toBeNull(); // fewer than 2 colleges: no page
  });

  it("adds the hub, each district and each group page when district data is given", () => {
    const paths = allPages(SITE, { ...DATA, districts: [PUNE, WASHIM] }).map((p) => p.path);
    expect(paths).toEqual(expect.arrayContaining(["/engineering-colleges", "/engineering-colleges/pune", "/engineering-colleges/pune/computer-it", "/engineering-colleges/washim"]));
    expect(paths).not.toContain("/engineering-colleges/washim/computer-it");
    expect(fileFor("/engineering-colleges/pune/computer-it")).toBe("engineering-colleges/pune/computer-it.html");
    const hub = hubPage(SITE, 2026, [PUNE, WASHIM]);
    expect(hub.body).toContain('<a href="/engineering-colleges/pune">Pune</a>: 2 colleges');
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
    const prerendered = (r: string) => r in STATIC_PAGE_META || r.startsWith("/colleges/:code") || r.startsWith(DISTRICT_HUB_PATH);
    const listed = (r: string) => APP_ONLY_ROUTES.some((a) => a === r || (a.endsWith("/**") && r.startsWith(a.slice(0, -3) + "/")));
    for (const r of routes) expect(prerendered(r) || listed(r), r).toBe(true);
  });
});
