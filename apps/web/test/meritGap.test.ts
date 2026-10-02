import { describe, expect, it } from "vitest";
import { describeMeritGap } from "../src/lib/meritGap";

describe("describeMeritGap (#140)", () => {
  it("calls a smaller merit number better", () => {
    const g = describeMeritGap(12450, 14000);
    expect(g.kind).toBe("better");
    expect(g.diff).toBe(1550);
    expect(g.short).toBe("1,550 better");
    expect(g.long).toBe("Your merit number 12,450 is 1,550 better than last year's closing (14,000).");
  });

  it("calls a larger merit number worse", () => {
    const g = describeMeritGap(12450, 8500);
    expect(g.kind).toBe("worse");
    expect(g.short).toBe("3,950 worse");
    expect(g.long).toBe("Your merit number 12,450 is 3,950 worse than last year's closing (8,500).");
  });

  it("handles an exact match", () => {
    const g = describeMeritGap(5000, 5000);
    expect(g.kind).toBe("equal");
    expect(g.diff).toBe(0);
    expect(g.short).toBe("same as closing");
  });

  it("never uses the banned words", () => {
    for (const [m, c] of [[100, 200], [200, 100], [7, 7]]) {
      const g = describeMeritGap(m, c);
      expect(`${g.short} ${g.long}`).not.toMatch(/above|below|spare|safe|short|seats/i);
    }
  });
});
