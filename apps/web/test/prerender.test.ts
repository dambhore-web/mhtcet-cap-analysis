import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allPages, APP_ONLY_ROUTES, APP_SHELL, branchGroupPage, branchPage, collegePage, contextIndex, estimatePage, guidePage, districtGroupPage, districtPage, fileFor, homePage, hubPage, OG_IMAGE,
  prerenderedServeConfig, renderPage, staticPage, trendSentence, type SeoBranch, type SeoData,
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
    expect(html).toContain("<title>COEP Technological University cutoff 2026 — MHT-CET CAP, all branches | GetMeCollege</title>");
    expect(html).toContain('<meta name="description" content="COEP Technological University, Pune: MHT-CET CAP 2026 cutoffs for 2 branches. Computer Science and Engineering closed at merit 150');
    expect(html).toContain('<link rel="canonical" href="https://getmecollege.com/colleges/16006" />');
    expect(html).toContain('<meta property="og:url" content="https://getmecollege.com/colleges/16006" />');
    expect(html).toContain('"@type":"CollegeOrUniversity"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('<a href="/colleges/16006/1600624210">Computer Science and Engineering</a></td><td>150</td><td>170</td><td>–</td><td>–</td><td>General open, state level</td>');
    expect(html).toContain("<h1>COEP Technological University cutoff 2026</h1>");
    // the app's own script still loads
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
  });

  it("escapes text from the data, in the page and in the structured data", () => {
    const html = renderPage(TEMPLATE, SITE, branchPage(SITE, 2026, DATA.colleges[0], DATA.colleges[0].branches[1]));
    expect(html).toContain("<h1>AI &amp; &lt;ML&gt; cutoff, COEP Technological University</h1>");
    expect(html).not.toContain("<ML>");
    expect(html).toContain("\\u003cML>"); // inside JSON-LD a "<" can't close the script
    expect(html).toContain("<dd>–</dd>"); // no Round I closing: a dash, not a made-up number
  });

  it("a branch page: numbers in the text, category and year tables, questions and links to neighbours", () => {
    const rich: SeoBranch = {
      ...DATA.colleges[0].branches[0],
      roundIPct: 99.9767207, latestPct: 99.9723948, intake: 300,
      past: [{ year: 2024, roundI: 96, latest: 121 }, { year: 2025, roundI: 243, latest: 913 }],
      seatTypes: [
        { seatType: "GOPENS", roundI: 150, percentile: 99.9767 },
        { seatType: "GOBCS", roundI: 463, percentile: 99.9014 },
        { seatType: "TFWS", roundI: 287, percentile: null },
      ],
      allIndia: { roundI: 212, percentile: 99.481177 },
    };
    const college = { ...DATA.colleges[0], branches: [rich, DATA.colleges[0].branches[1]] };
    const ctx = contextIndex([PUNE]).get("16006");
    const page = branchPage(SITE, 2026, college, rich, ctx);
    const html = renderPage(TEMPLATE, SITE, page);
    expect(html).toContain("<title>Computer Science and Engineering cutoff, COEP Technological University — CAP 2024–2026 | GetMeCollege</title>");
    expect(page.body).toContain("Computer Science and Engineering at COEP Technological University closed at merit 150 (99.976 percentile) in CAP 2026 Round I on open seats, 170 in the last round.");
    expect(page.body).toContain("got harder to get on open seats: the Round I closing merit number fell from 243 in 2025 to 150 in 2026");
    expect(page.body).toContain("<td>General OBC, state level</td><td>463</td><td>99.901</td>");
    expect(page.body).toContain("<td>Tuition fee waiver (TFWS)</td><td>287</td><td>–</td>");
    expect(page.body).toContain("<tr><td>2024</td><td>96</td><td>121</td></tr>");
    expect(page.body).toContain("All India merit 212 (JEE Main 99.48 percentile)");
    expect(page.body).toContain("<dt>CAP seats</dt><dd>300</dd>");
    // a neighbour in the same branch group and district, and the college's other branches
    expect(page.body).toContain('<a href="/colleges/06271/0627124210">Computer Engineering, Pune Institute of &lt;Computer&gt; Technology</a>: 900');
    expect(page.body).toContain('<a href="/engineering-colleges/pune/computer-it">Computer &amp; IT engineering colleges in Pune</a>');
    expect(page.body).toContain('<a href="/colleges/16006/1600692110">AI &amp; &lt;ML&gt;</a>: 633');
    expect(page.body).toContain('<a href="/engineering-colleges/pune">Pune</a>');
    const types = page.jsonLd.map((j) => (j as { "@type": string })["@type"]);
    // the questions are in the page; no FAQPage data, as the app view doesn't show them
    expect(types).toEqual(["WebPage", "BreadcrumbList"]);
    expect(page.body).toContain("What was the Computer Science and Engineering cutoff at COEP Technological University in CAP 2026?");
    expect(`${page.meta.title} ${page.meta.description} ${page.body}`).not.toMatch(/guarantee|you can get|you will get|\bsafe\b/i);
  });

  it("describes a cutoff trend in plain words, lower merit numbers being harder", () => {
    const b = DATA.colleges[0].branches[0];
    expect(trendSentence("CSE", 2026, { ...b, roundI: 300, past: [{ year: 2025, roundI: 200, latest: 250 }] })).toContain("got easier to get on open seats: the Round I closing merit number rose from 200 in 2025 to 300 in 2026");
    expect(trendSentence("CSE", 2026, { ...b, past: [] })).toBeNull();
    expect(trendSentence("CSE", 2026, { ...b, roundI: null, past: [{ year: 2025, roundI: 200, latest: 250 }] })).toBeNull();
  });

  it("a college page: facts, fee and salary from the district data, questions and nearby colleges", () => {
    const ctx = contextIndex([PUNE]).get("16006");
    const page = collegePage(SITE, 2026, { ...DATA.colleges[0], intake: 600 }, ctx);
    expect(page.body).toContain("took part in MHT-CET CAP 2026 with 2 branches and 600 CAP seats");
    expect(page.body).toContain("<dt>Placements</dt><dd>₹12 lakh median salary (NIRF, batch 2024-25)</dd>");
    expect(page.body).toContain('<a href="/colleges/06271">Pune Institute of &lt;Computer&gt; Technology</a>');
    expect(page.body).toContain('<a href="/engineering-colleges/pune/computer-it">Computer &amp; IT engineering colleges in Pune</a>');
    expect(page.body).toContain("<h2>Questions</h2>");
    expect(page.jsonLd.map((j) => (j as { "@type": string })["@type"])).not.toContain("FAQPage");
  });

  it("the guide page: every section the app shows as tabs, and its questions as FAQPage data", () => {
    const page = guidePage(SITE);
    for (const h of ["How CAP works", "Freeze, float or slide", "Seat codes", "Questions"]) expect(page.body).toContain(`<h2>${h}</h2>`);
    expect(page.body).toContain("<h3>Float</h3>");
    expect(page.body).toContain("What does GOPENS mean in the CAP cutoff list?");
    expect(page.jsonLd.map((j) => (j as { "@type": string })["@type"])).toEqual(["WebPage", "FAQPage"]);
    expect(staticPage(SITE, "/guide", DATA).body).toBe(page.body);
  });

  it("the estimate page: percentile → merit number tables read off the printed pairs, with questions", () => {
    const scales = {
      year: 2026,
      mh: [[100, 99.98], [1000, 99.7], [10000, 97.5], [50000, 88.1], [200000, 10]] as [number, number][],
      ai: [[212, 99.48], [98000, 0.2]] as [number, number][],
    };
    const page = estimatePage(SITE, scales);
    expect(page.body).toContain("<h1>MHT-CET percentile vs merit number, CAP 2026</h1>");
    expect(page.body).toContain("<tr><td>99.5</td><td>1,820</td></tr>"); // between 1,000 at 99.7 and 10,000 at 97.5
    expect(page.body).toContain("<tr><td>95</td><td>");
    expect(page.body).toContain("What merit number is 95 percentile in MHT-CET 2026?");
    expect(page.body).toContain("JEE Main percentile vs All India merit number");
    expect(page.jsonLd.map((j) => (j as { "@type": string })["@type"])).toEqual(["WebPage", "FAQPage"]);
    // without the pairs, the plain static page
    expect(staticPage(SITE, "/estimate", DATA).body).not.toContain("<table>");
  });

  it("a branch-group page: every college offering the group, hardest first, with district links", () => {
    const data: SeoData = {
      ...DATA,
      colleges: [
        { ...DATA.colleges[0], branches: [{ ...DATA.colleges[0].branches[0], group: "Computer & IT", intake: 300 }, { ...DATA.colleges[0].branches[1], group: null }] },
        { code: "06271", name: "PICT", district: "Pune", collegeType: "Un-Aided", branches: [{ choiceCode: "0627124210", name: "Computer Engineering", group: "Computer & IT", roundI: 900, latest: 950, seatType: "GOPENO", years: [2026], intake: 120 }] },
      ],
      districts: [PUNE],
    };
    const page = branchGroupPage(SITE, data, "Computer & IT");
    expect(page.path).toBe("/branches/computer-it");
    expect(page.meta.title).toBe("Computer & IT engineering colleges in Maharashtra — CAP cutoffs");
    expect(page.body).toContain("2 colleges offered 2 Computer &amp; IT branches in MHT-CET CAP 2026, with 420 CAP seats.");
    // hardest to get first
    expect(page.body.indexOf("1600624210")).toBeLessThan(page.body.indexOf("0627124210"));
    expect(page.body).not.toContain("1600692110"); // not in the group
    expect(page.body).toContain('<a href="/engineering-colleges/pune/computer-it">Computer &amp; IT engineering colleges in Pune</a> (2)');
    expect(page.jsonLd.map((j) => (j as { "@type": string })["@type"])).toEqual(["CollectionPage", "BreadcrumbList"]);
    expect(allPages(SITE, data).map((p) => p.path)).toContain("/branches/computer-it");
    expect(staticPage(SITE, "/branches", data).body).toContain('<a href="/branches/computer-it">Computer &amp; IT engineering colleges in Maharashtra</a>');
    expect(homePage(SITE, data).body).toContain('<a href="/branches/computer-it">Computer &amp; IT</a>');
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

  it("serve.json keeps the security headers and sends only app routes to the empty app shell", () => {
    const cfg = prerenderedServeConfig({ headers: [{ source: "**", headers: [] }] });
    expect(cfg.headers).toHaveLength(1);
    expect(cfg.cleanUrls).toBe(true);
    expect(cfg.rewrites.map((r) => r.source)).toEqual(APP_ONLY_ROUTES);
    expect(new Set(cfg.rewrites.map((r) => r.destination))).toEqual(new Set([`/${APP_SHELL}`]));
    expect(cfg.rewrites.some((r) => r.source === "**")).toBe(false);
  });

  it("the home page: canonical, a real heading and links to districts, top colleges and the guides", () => {
    const home = homePage(SITE, { ...DATA, districts: [PUNE, WASHIM] });
    expect(home.path).toBe("/");
    expect(home.body).toContain("<h1>MHT-CET CAP cutoffs for every Maharashtra engineering college and branch</h1>");
    expect(home.body).toContain('<a href="/engineering-colleges/pune">Engineering colleges in Pune</a> (2)');
    expect(home.body).toContain('<a href="/engineering-colleges/pune/computer-it">Computer &amp; IT colleges in Pune</a>');
    expect(home.body).toContain('<a href="/colleges/16006">COEP Technological University</a>, Pune: from 150');
    for (const link of ["/estimate", "/guide", "/colleges", "/branches"]) expect(home.body).toContain(`href="${link}"`);
    expect(home.body).toContain("CAP 2024–2026");
    expect(home.jsonLd.map((j) => (j as { "@type": string })["@type"])).toEqual(["WebSite", "WebPage"]);
    const html = renderPage(TEMPLATE, SITE, home);
    expect(html).toContain('<link rel="canonical" href="https://getmecollege.com/" />');
    expect(html).not.toMatch(/<div id="root"><\/div>/);
  });

  it("every page carries the share image, with its size and alt text", () => {
    const html = renderPage(TEMPLATE, SITE, collegePage(SITE, 2026, DATA.colleges[0]));
    expect(html).toContain(`<meta property="og:image" content="https://getmecollege.com${OG_IMAGE.path}" />`);
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain('<meta name="twitter:image" content="https://getmecollege.com/og-image.png" />');
    expect(html).toContain('property="og:image:alt"');
  });

  it("every route in App.tsx is either prerendered or listed as an app-only route", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    const routes = [...app.matchAll(/path="([^"]+)"/g)].map((m) => "/" + m[1]).filter((r) => r !== "/*");
    const prerendered = (r: string) =>
      r in STATIC_PAGE_META || r.startsWith("/colleges/:code") || r.startsWith(DISTRICT_HUB_PATH) || r === "/branches/:group";
    const listed = (r: string) => APP_ONLY_ROUTES.some((a) => a === r || (a.endsWith("/**") && r.startsWith(a.slice(0, -3) + "/")));
    for (const r of routes) expect(prerendered(r) || listed(r), r).toBe(true);
  });
});
