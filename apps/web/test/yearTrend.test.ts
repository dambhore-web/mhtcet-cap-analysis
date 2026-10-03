import { describe, expect, it } from "vitest";
import { pastSummary, trendVerdict, yearSeries, yearsWithin, type HistoryRow } from "../src/lib/yearTrend";

const row = (year: number, round: string, closingMerit: number, seatType = "GOPENS", stage = "I"): HistoryRow => ({
  year, round, seatType, section: "State Level", stage, closingMerit, closingPercentile: null,
});

const rows: HistoryRow[] = [
  row(2023, "I", 5200), row(2023, "II", 5600), row(2023, "III", 6100),
  row(2024, "I", 4900), row(2024, "III", 5800),
  row(2025, "I", 4500), row(2025, "IV", 6400),
  row(2026, "I", 4100), row(2026, "I", 4300, "GOPENS", "II"), row(2026, "IV", 6000),
  row(2026, "I", 9000, "GOBCS"),
];

describe("yearSeries", () => {
  it("takes Round I of each year, first printed stage", () => {
    expect(yearSeries(rows, "GOPENS", "first").map((p) => [p.year, p.closingMerit])).toEqual([[2023, 5200], [2024, 4900], [2025, 4500], [2026, 4100]]);
  });
  it("takes each year's last round (three rounds in 2023–2024)", () => {
    expect(yearSeries(rows, "GOPENS", "last").map((p) => [p.year, p.round, p.closingMerit])).toEqual([
      [2023, "III", 6100], [2024, "III", 5800], [2025, "IV", 6400], [2026, "IV", 6000],
    ]);
  });
  it("leaves out years without the seat type", () => {
    expect(yearSeries(rows, "GOBCS", "first").map((p) => p.year)).toEqual([2026]);
  });
});

describe("trendVerdict", () => {
  it("calls a falling closing rank harder", () => {
    const v = trendVerdict(yearSeries(rows, "GOPENS", "first"))!;
    expect(v.direction).toBe("harder");
    expect(v.change).toBeCloseTo((4100 - 5200) / 5200);
  });
  it("calls a change within 5% steady, and needs two years", () => {
    expect(trendVerdict(yearSeries(rows, "GOPENS", "last"))!.direction).toBe("steady");
    expect(trendVerdict(yearSeries(rows, "GOBCS", "first"))).toBeNull();
  });
});

describe("yearsWithin", () => {
  it("lists the years a merit was within the closing rank", () => {
    expect(yearsWithin(yearSeries(rows, "GOPENS", "first"), 4600)).toEqual([2023, 2024]);
  });
});

describe("pastSummary", () => {
  const past = [
    { year: 2023, lastRoundClosing: 5600 },
    { year: 2024, lastRoundClosing: 5800 },
    { year: 2025, lastRoundClosing: 6400 },
  ];
  it("counts the years the merit was within the last-round closing rank", () => {
    expect(pastSummary(past, 5900)).toEqual({ years: 3, within: 1, lo: 5600, hi: 6400, first: 2023, last: 2025 });
    expect(pastSummary(past, 5600)!.within).toBe(3);
    expect(pastSummary(past, 7000)!.within).toBe(0);
  });
  it("is null without earlier years", () => {
    expect(pastSummary([], 100)).toBeNull();
  });
});
