import { describe, expect, it } from "vitest";
import { extractClaims, latestYear, summariseClaims } from "../src/parse/placementClaims.ts";

const url = "https://example.org/placements";

describe("college placement claims", () => {
  it("reads labelled packages on one line, in lakhs, crores and rupees", () => {
    const c = extractClaims(
      [
        "Placement Highlights 2024-25",
        "Highest Package: 44 LPA | Average Package: ₹6.5 Lakh | Median salary 5.2 lakhs per annum",
        "Top offer of Rs. 1.2 Cr from a product company in 2023",
        "Max package ₹ 12,00,000",
      ].join("\n"),
      url,
    );
    expect(c.map((x) => [x.metric, x.value, x.year])).toEqual([
      ["highest", 4_400_000, "2024-25"],
      ["average", 650_000, "2024-25"],
      ["median", 520_000, "2024-25"],
      ["highest", 12_000_000, "2023"],
      ["highest", 1_200_000, "2023"],
    ]);
    expect(c[0].snippet).toBe("Highest Package: 44 LPA");
  });

  it("pairs counter widgets that print the amount and label on separate lines", () => {
    const c = extractClaims("Placements 2025\n18 LPA\nHighest Package\n4.2 LPA\nAverage Package", url);
    expect(c.map((x) => [x.metric, x.value])).toEqual([["highest", 1_800_000], ["average", 420_000]]);
  });

  it("reads placement tables, one row per year", () => {
    const c = extractClaims(
      "ACADEMIC YEAR\tTOTAL ENROLLED\tAVERAGE PACKAGE\tHIGHEST PACKAGE\tPLACEMENT %\n2025-26\t680\t5.5 LPA\t61 LPA\t82%\n2024-25\t697\t5.12 LPA\t27 LPA\t79%",
      url,
    );
    expect(c.map((x) => [x.metric, x.value, x.year])).toEqual([
      ["average", 550_000, "2025-26"], ["highest", 6_100_000, "2025-26"], ["placedPct", 82, "2025-26"],
      ["average", 512_000, "2024-25"], ["highest", 2_700_000, "2024-25"], ["placedPct", 79, "2024-25"],
    ]);
    expect(c[1].snippet).toBe("HIGHEST PACKAGE: 61 LPA (2025-26)");
  });

  it("reads qualified labels and percentage counters", () => {
    const c = extractClaims("Placements 2025\n1.2 Cr.\nHighest UG Package Offered\n92%\nPlacements Record", url);
    expect(c.map((x) => [x.metric, x.value])).toEqual([["highest", 12_000_000], ["placedPct", 92]]);
  });

  it("reads placement percentages both ways round", () => {
    const c = extractClaims("92% students placed in 2024-25\nPlacement record: 85%", url);
    expect(c.map((x) => [x.metric, x.value])).toEqual([["placedPct", 92], ["placedPct", 85]]);
  });

  it("ignores placement promises and marketing percentages", () => {
    expect(extractClaims("100% placement readiness through training\nOur aim is to achieve 100% placement\n100% Placement Assistance", url)).toEqual([]);
  });

  it("ignores stipends, fees and amounts that cannot be a salary", () => {
    const c = extractClaims("Highest stipend 50,000 per month\nTuition fee Rs. 1,20,000\nHighest package 500 LPA\nOver 100% growth", url);
    expect(c).toEqual([]);
  });

  it("skips postgraduate and diploma figures, and uses the page heading's year", () => {
    const c = extractClaims("Placement Data 2025-26\nB.Tech Computer\n72 LPA\nHighest CTC\nM.Tech Computer Highest CTC: 23 LPA\nDiploma highest package 4 LPA", url);
    expect(c.map((x) => [x.metric, x.value, x.year])).toEqual([["highest", 7_200_000, "2025-26"]]);
    expect(extractClaims("M.Tech Placement Data 2025-26\nHighest package 23 LPA", url)).toEqual([]);
  });

  it("finds the latest year near a figure", () => {
    expect(latestYear("Batch 2022-23 and 2023-24")).toBe("2023-24");
    expect(latestYear("Placed in 2025, batch 2023-24")).toBe("2025");
    expect(latestYear("Since 1999")).toBeNull();
  });

  it("summarises the most recent year, dropping an average above the highest", () => {
    const claims = [
      ...extractClaims("2023-24\nHighest package 30 LPA\nAverage package 5 LPA", url),
      ...extractClaims("2024-25\nHighest package 24 LPA\nHighest package 18 LPA\nAverage package 40 LPA\n90% placement", url),
    ];
    const s = summariseClaims(claims)!;
    expect(s).toMatchObject({ year: "2024-25", highest: 2_400_000, average: null, median: null, placedPct: 90 });
    expect(s.claims.every((c) => c.year === "2024-25")).toBe(true);
  });

  it("returns null without any usable figure", () => {
    expect(summariseClaims([])).toBeNull();
  });
});
