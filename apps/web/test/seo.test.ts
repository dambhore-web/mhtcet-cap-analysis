import { describe, expect, it } from "vitest";
import { branchMeta, clip, collegeMeta, fullTitle } from "../src/lib/seo";

describe("page meta (SEO)", () => {
  it("adds the site name once", () => {
    expect(fullTitle("Your options")).toBe("Your options | Compass");
    expect(fullTitle("Compass — MHT-CET CAP cutoffs")).toBe("Compass — MHT-CET CAP cutoffs");
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
    expect(m.title).toBe("COEP Technological University — CAP 2026 cutoffs by branch");
    expect(m.description).toContain("9 branches at COEP Technological University, Pune");
    expect(m.description!.length).toBeLessThanOrEqual(160);
    expect(collegeMeta({ name: "X" }, 1, 2026).description).toContain("1 branch at X:");
  });

  it("describes a branch page with its years", () => {
    const m = branchMeta("COEP Technological University", "Computer Engineering", [2023, 2026, 2024, 2025]);
    expect(m.title).toBe("Computer Engineering, COEP Technological University — CAP cutoffs 2023–2026");
    expect(branchMeta("X", "Civil Engineering", [2026]).title).toBe("Civil Engineering, X — CAP cutoffs 2026");
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
