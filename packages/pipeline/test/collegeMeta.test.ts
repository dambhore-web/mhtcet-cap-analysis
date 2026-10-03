import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const meta = JSON.parse(readFileSync(new URL("../data/college-meta-2026.json", import.meta.url), "utf8")) as Record<
  string,
  { district: string | null; collegeType: string | null }
>;

describe("college districts (college-meta-2026.json)", () => {
  it("has a district for every college, from the known Maharashtra districts", () => {
    const names = new Set(Object.values(meta).map((m) => m.district));
    expect(names.has(null)).toBe(false);
    expect(names.has("Mumbai")).toBe(false); // always Mumbai-City or Mumbai-Suburban
  });

  it("keeps the corrections for districts once guessed wrongly from the name (migration 009)", () => {
    expect(meta["03012"].district).toBe("Mumbai-City"); // VJTI, Matunga
    expect(meta["03036"].district).toBe("Mumbai-City"); // ICT, Matunga
    expect(meta["06725"].district).toBe("Solapur"); // New Satara College, Pandharpur
    expect(meta["03465"].district).toBe("Palghar"); // Ideal Institute, Wada
    expect(meta["03014"].district).toBe("Mumbai-Suburban"); // SPCE, Andheri
  });
});
