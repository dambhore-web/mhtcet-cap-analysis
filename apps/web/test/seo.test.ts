import { describe, expect, it } from "vitest";
import { branchMeta, clip, collegeMeta, fullTitle, openClosing, publicAddressRedirect } from "../src/lib/seo";

describe("page meta (SEO)", () => {
  it("adds the site name once", () => {
    expect(fullTitle("Your options")).toBe("Your options | GetMeCollege");
    expect(fullTitle("GetMeCollege — MHT-CET CAP cutoffs")).toBe("GetMeCollege — MHT-CET CAP cutoffs");
  });

  it("clips descriptions at a word, near what search results show", () => {
    const long = "word ".repeat(60).trim();
    const c = clip(long);
    expect(c.length).toBeLessThanOrEqual(160);
    expect(c.endsWith("…")).toBe(true);
    expect(c).not.toMatch(/wor…$/);
    expect(clip("short")).toBe("short");
  });

  it("describes a college page from its real data", () => {
    const m = collegeMeta({ name: "COEP Technological University", district: "Pune" }, 9, 2026);
    expect(m.title).toBe("COEP Technological University cutoff 2026 — MHT-CET CAP, all branches");
    expect(m.description).toContain("9 branches at COEP Technological University, Pune");
    expect(m.description!.length).toBeLessThanOrEqual(160);
    expect(collegeMeta({ name: "X" }, 1, 2026).description).toContain("1 branch at X:");
  });

  it("describes a branch page with its years", () => {
    const m = branchMeta("COEP Technological University", "Computer Engineering", [2023, 2026, 2024, 2025]);
    expect(m.title).toBe("Computer Engineering cutoff, COEP Technological University — CAP 2023–2026");
    expect(branchMeta("X", "Civil Engineering", [2026]).title).toBe("Civil Engineering cutoff, X — CAP 2026");
  });

  it("puts the real closing numbers in the descriptions when they are known", () => {
    const open = { year: 2026, roundI: 150, roundIPct: 99.9767, latest: 170 };
    expect(branchMeta("COEP", "CSE", [2026], open).description).toBe(
      "CSE at COEP closed at merit 150 (99.976 percentile) in CAP 2026 Round I on open seats, 170 in the last round. Every round and seat type, 2026.",
    );
    expect(collegeMeta({ name: "COEP", district: "Pune" }, 9, 2026, { branch: "CSE", closing: open }).description).toContain("COEP, Pune: MHT-CET CAP 2026 cutoffs for 9 branches. CSE closed at merit 150");
    // no Round I value: the last round is named instead
    expect(branchMeta("X", "Y", [2026], { year: 2026, roundI: null, latest: 900 }).description).toContain("closed at merit 900 in the last round of CAP 2026 on open seats.");
  });

  it("finds a branch's open-seat closing from its rows, state level first", () => {
    const rows = [
      { list: "MH", round: "II", seatType: "GOPENS", closingMerit: 170, closingPercentile: 99.97 },
      { list: "MH", round: "I", seatType: "GOPENS", closingMerit: 150, closingPercentile: 99.98 },
      { list: "MH", round: "I", seatType: "GOPENH", closingMerit: 90, closingPercentile: 99.99 },
      { list: "AI", round: "I", seatType: "AI", closingMerit: 10, closingPercentile: 99.9 },
    ];
    expect(openClosing(rows, 2026)).toEqual({ year: 2026, roundI: 150, roundIPct: 99.98, latest: 170 });
    expect(openClosing(rows.filter((r) => r.seatType === "AI"), 2026)).toBeNull();
  });

  it("never promises a seat", () => {
    const text = [collegeMeta({ name: "X", district: "Pune" }, 5, 2026), branchMeta("X", "Y", [2025, 2026])].map((m) => `${m.title} ${m.description}`).join(" ");
    expect(text).not.toMatch(/guarantee|you can get|you will get|\bsafe\b/i);
  });
});

describe("college meta: place names", () => {
  it("adds the district only when the name doesn't already say it", () => {
    expect(collegeMeta({ name: "VJTI, Matunga, Mumbai", district: "Mumbai-Suburban" }, 9, 2026).description).toContain("9 branches at VJTI, Matunga, Mumbai:");
    expect(collegeMeta({ name: "COEP Technological University", district: "Pune" }, 9, 2026).description).toContain("COEP Technological University, Pune:");
  });
});

describe("one public address (SEO)", () => {
  const at = (hostname: string, pathname = "/colleges/16006", search = "?x=1", hash = "#cutoffs") => ({ hostname, pathname, search, hash });
  const SITE = "https://getmecollege.com/";

  it("sends a visit on the hosting platform's address to the same page on the public address", () => {
    expect(publicAddressRedirect(SITE, at("mhtcetweb-production.up.railway.app"))).toBe("https://getmecollege.com/colleges/16006?x=1#cutoffs");
  });

  it("leaves the public address, local runs and sites without a public address alone", () => {
    expect(publicAddressRedirect(SITE, at("getmecollege.com"))).toBeNull();
    expect(publicAddressRedirect(SITE, at("localhost"))).toBeNull();
    expect(publicAddressRedirect(undefined, at("compass-web-staging-276c.up.railway.app"))).toBeNull();
    expect(publicAddressRedirect("", at("compass-web-staging-276c.up.railway.app"))).toBeNull();
    expect(publicAddressRedirect("not a url", at("x.up.railway.app"))).toBeNull();
  });
});
