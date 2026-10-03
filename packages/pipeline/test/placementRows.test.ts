import { describe, expect, it } from "vitest";
import type { NirfPlacementRow } from "../src/parse/nirf.ts";
import { buildPlacementRows, nirfCategory, nirfEdition, type PlacementProblem } from "../src/placement/placementRows.ts";

const row = (graduationYear: string, graduates: number, placed: number | null, medianSalary: number | null): NirfPlacementRow => ({
  graduationYear, graduates, placed, medianSalary, higherStudies: 5,
});

const doc = (id: string | null, url: string, rows: NirfPlacementRow[]) => ({
  collegeCode: "09999", sourceUrl: url, parsed: { instituteName: "Test College", instituteId: id, rows },
});

describe("placement rows", () => {
  it("names NIRF categories and editions", () => {
    expect(nirfCategory("IR-E-C-12345")?.name).toBe("Engineering");
    expect(nirfCategory("IR-O-C-12345")?.name).toBe("Overall");
    expect(nirfCategory("IR-A-C-12345")).toBeNull();
    expect(nirfEdition([row("2022-23", 1, 1, 1), row("2024-25", 1, 1, 1)])).toBe(2026);
  });

  it("takes each batch from the newest edition, Engineering before Overall", () => {
    const problems: PlacementProblem[] = [];
    const rows = buildPlacementRows([
      doc("IR-E-C-1", "https://x/2025-engg.pdf", [row("2021-22", 100, 60, 300000), row("2022-23", 100, 70, 310000), row("2023-24", 100, 80, 320000)]),
      doc("IR-O-C-1", "https://x/2026-overall.pdf", [row("2022-23", 900, 700, 400000), row("2023-24", 900, 700, 400000), row("2024-25", 900, 700, 400000)]),
      doc("IR-E-C-1", "https://x/2026-engg.pdf", [row("2022-23", 101, 71, 311000), row("2023-24", 101, 81, 321000), row("2024-25", 102, 90, 330000)]),
    ], problems);
    expect(problems).toEqual([]);
    expect(rows.map((r) => [r.graduationYear, r.graduates, r.nirfYear, r.nirfCategory, r.sourceUrl])).toEqual([
      ["2021-22", 100, 2025, "Engineering", "https://x/2025-engg.pdf"],
      ["2022-23", 101, 2026, "Engineering", "https://x/2026-engg.pdf"],
      ["2023-24", 101, 2026, "Engineering", "https://x/2026-engg.pdf"],
      ["2024-25", 102, 2026, "Engineering", "https://x/2026-engg.pdf"],
    ]);
  });

  it("uses Overall when it is the only edition with a batch", () => {
    const rows = buildPlacementRows([doc("IR-O-C-1", "https://x/o.pdf", [row("2024-25", 200, 150, 450000)])], []);
    expect(rows[0]).toMatchObject({ nirfCategory: "Overall", nirfYear: 2026 });
  });

  it("skips and reports rows that cannot be right and documents without a usable ID", () => {
    const problems: PlacementProblem[] = [];
    const rows = buildPlacementRows([
      doc("IR-E-C-1", "https://x/a.pdf", [row("2024-25", 100, 150, 400000), row("2023-24", 100, 50, 400000)]),
      doc(null, "https://x/b.pdf", [row("2024-25", 100, 50, 400000)]),
      doc("IR-A-C-1", "https://x/c.pdf", [row("2024-25", 100, 50, 400000)]),
    ], problems);
    expect(rows.map((r) => r.graduationYear)).toEqual(["2023-24"]);
    expect(problems.map((p) => p.problem)).toEqual(["2024-25: placed > graduates", "no NIRF institute ID", "category of IR-A-C-1 not used"]);
  });
});
