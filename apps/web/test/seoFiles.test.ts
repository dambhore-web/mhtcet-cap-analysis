import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs build script, no type declarations
import { buildRobots, buildSitemapXml, sitemapPaths, STATIC_PATHS } from "../scripts/write-seo-files.mjs";

const DATA = { year: 2026, colleges: [{ code: "16006", branches: ["1600601910", "1600624210"] }, { code: "06271", branches: ["0627124210"] }] };

describe("robots.txt and sitemap.xml (SEO)", () => {
  it("blocks all crawlers when there is no public site address (staging, previews)", () => {
    expect(buildRobots("")).toMatch(/User-agent: \*\nDisallow: \/\n/);
    expect(buildRobots("")).not.toMatch(/Sitemap:/);
  });

  it("allows crawling and points to the sitemap on the public site, keeping shared summaries out", () => {
    const r = buildRobots("https://compass.example/");
    expect(r).toContain("Allow: /");
    expect(r).toContain("Disallow: /summary");
    expect(r).toContain("Sitemap: https://compass.example/sitemap.xml");
  });

  it("lists the public pages, every college and every branch", () => {
    const paths = sitemapPaths(DATA);
    expect(paths.slice(0, STATIC_PATHS.length)).toEqual(STATIC_PATHS);
    expect(paths).toContain("/colleges/16006");
    expect(paths).toContain("/colleges/16006/1600624210");
    expect(paths).toContain("/colleges/06271/0627124210");
    expect(paths).toHaveLength(STATIC_PATHS.length + 2 + 3);
    expect(paths.some((p: string) => /profile|list|find|simulator|summary/.test(p))).toBe(false);
  });

  it("lists the statewide branch-group pages", () => {
    const paths = sitemapPaths({ ...DATA, branchGroups: ["computer-it", "mechanical"] });
    expect(paths).toContain("/branches/computer-it");
    expect(paths).toContain("/branches/mechanical");
    expect(sitemapPaths(DATA).some((p: string) => p.startsWith("/branches/"))).toBe(false);
  });

  it("lists the district landing pages and their branch-group pages", () => {
    const paths = sitemapPaths({ ...DATA, districts: [{ slug: "pune", groups: ["computer-it", "mechanical"] }, { slug: "washim", groups: [] }] });
    expect(paths.slice(-5)).toEqual([
      "/engineering-colleges",
      "/engineering-colleges/pune",
      "/engineering-colleges/pune/computer-it",
      "/engineering-colleges/pune/mechanical",
      "/engineering-colleges/washim",
    ]);
    expect(sitemapPaths(DATA)).not.toContain("/engineering-colleges");
  });

  it("writes valid sitemap XML with absolute URLs", () => {
    const xml = buildSitemapXml("https://compass.example/", DATA);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<loc>https://compass.example/colleges/16006</loc>");
    expect(xml).toContain("<loc>https://compass.example/</loc>");
    expect((xml.match(/<url>/g) ?? []).length).toBe(STATIC_PATHS.length + 5);
  });
});
