import { describe, expect, it } from "vitest";
import type { PlacementBatch } from "../src/lib/api";
import { formatLakh, latestPlaced, recentBatches, salaryChange } from "../src/lib/placement";

const batch = (graduationYear: string, placed: number | null, medianSalary: number | null): PlacementBatch => ({
  graduationYear, graduates: 100, placed, placedPct: placed, medianSalary, higherStudies: 5, higherStudiesPct: 5,
  nirfYear: 2026, nirfCategory: "Engineering", sourceUrl: "https://example.org/nirf.pdf",
});

describe("placement helpers", () => {
  it("formats salaries in lakh", () => {
    expect(formatLakh(1_120_000)).toBe("₹11.2 lakh");
    expect(formatLakh(300_000)).toBe("₹3 lakh");
    expect(formatLakh(85_000)).toBe("₹85,000");
    expect(formatLakh(12_500_000)).toBe("₹125 lakh");
  });

  it("picks the newest batch with a placement figure", () => {
    expect(latestPlaced([batch("2022-23", 70, 400000), batch("2023-24", 80, 420000), batch("2024-25", null, null)])?.graduationYear).toBe("2023-24");
    expect(latestPlaced([batch("2024-25", null, null)])).toBeNull();
  });

  it("lists recent batches newest first", () => {
    const all = ["2019-20", "2020-21", "2021-22", "2022-23", "2023-24", "2024-25"].map((y) => batch(y, 50, 300000));
    expect(recentBatches(all, 3).map((b) => b.graduationYear)).toEqual(["2024-25", "2023-24", "2022-23"]);
  });

  it("measures the salary change across batches that report one", () => {
    const c = salaryChange([batch("2022-23", 70, 400000), batch("2023-24", 80, null), batch("2024-25", 85, 500000)]);
    expect(c?.change).toBeCloseTo(0.25);
    expect(c?.from.graduationYear).toBe("2022-23");
    expect(salaryChange([batch("2024-25", 85, 500000)])).toBeNull();
  });
});
