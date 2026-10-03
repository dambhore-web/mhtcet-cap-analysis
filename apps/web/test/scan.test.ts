import { describe, expect, it } from "vitest";
import { scanStages, seatTypesLine, stagesDone, type ScanRequest } from "../src/lib/scan";
import type { DataMeta } from "../src/lib/api";

const req: ScanRequest = {
  merit: 12450, candidature: "MH", estimated: false, category: "OBC", gender: "F",
  homeUniversity: "Savitribai Phule Pune University",
  flags: { ews: false, tfws: true, defence: false, pwd: false, orphan: false }, minority: "",
};
const meta = { year: 2026, colleges: 387, branches: 2333, cutoffRows: 111754, earlierYears: [2025, 2023, 2024] } as DataMeta;

describe("scanStages", () => {
  it("names the real data and the student's merit number", () => {
    const s = scanStages(meta, req);
    expect(s.map((x) => x.title)).toEqual([
      "Loaded the 2026 CAP cutoffs:", "Matched the seats you can take:", "Compared merit number 12,450",
      "Checked 2023–2025 trends", "Sorted by your chances",
    ]);
    expect(s[0].detail).toBe("1,11,754 closing merit numbers across 387 colleges");
  });
  it("uses generic wording without the data counts, and skips trends without earlier years", () => {
    const s = scanStages(null, { ...req, estimated: true });
    expect(s[0].detail).not.toMatch(/\d/);
    expect(s).toHaveLength(4);
    expect(s[2].title).toBe("Compared estimated merit number 12,450");
  });
  it("names the percentile when the student searched by percentile", () => {
    expect(scanStages(null, { ...req, merit: 0, percentile: 96.4185 })[2].title).toBe("Compared percentile 96.41");
  });
});

describe("seatTypesLine", () => {
  it("lists the student's seat types, ladies seats only for female students", () => {
    expect(seatTypesLine(req, 50)).toContain("LOBCH");
    expect(seatTypesLine({ ...req, gender: "M" }, 50)).not.toContain("LOBCH");
    expect(seatTypesLine(req, 50)).toContain("TFWS");
  });
  it("says 'and N more' past the first few", () => {
    expect(seatTypesLine(req, 2)).toMatch(/^\w+, \w+ and \d+ more$/);
  });
  it("shows All India seats for JEE", () => {
    expect(seatTypesLine({ ...req, candidature: "AI" })).toBe("All India (AI) seats");
  });
});

describe("stagesDone", () => {
  it("ticks evenly and holds the last stage until the search is back", () => {
    expect(stagesDone(5, 0, false)).toBe(0);
    expect(stagesDone(5, 1500, false)).toBe(2);
    expect(stagesDone(5, 5000, false)).toBe(4);
    expect(stagesDone(5, 5000, true)).toBe(5);
  });
  it("waits the minimum time even when the search is fast", () => {
    expect(stagesDone(5, 1000, true)).toBe(1);
    expect(stagesDone(5, 3000, true)).toBe(5);
  });
  it("finishes as soon as the search is back when there is no minimum (reduced motion)", () => {
    expect(stagesDone(5, 0, true, 0)).toBe(5);
    expect(stagesDone(5, 0, false, 0)).toBe(4);
  });
});
