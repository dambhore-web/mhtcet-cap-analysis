import { describe, expect, it } from "vitest";
import {
  describePercentileGap, formatPercentile, meritToPercentile, parsePercentileText, percentileToMerit, type ScalePoint,
} from "../src/lib/percentile";

const SCALE: ScalePoint[] = [[100, 99.98], [1000, 99.7], [10000, 97.5], [50000, 88.1]];

describe("percentile ↔ merit number (Find page views)", () => {
  it("reads a typed percentile", () => {
    expect(parsePercentileText("96.42")).toBe(96.42);
    expect(parsePercentileText(" 96.42 % ")).toBe(96.42);
    expect(parsePercentileText("0")).toBeNull();
    expect(parsePercentileText("100.5")).toBeNull();
    expect(parsePercentileText("abc")).toBeNull();
  });

  it("formats with two decimals, three near the top, never rounding up past the real value", () => {
    expect(formatPercentile(96.4185)).toBe("96.41");
    expect(formatPercentile(99.9923)).toBe("99.992");
    expect(formatPercentile(88)).toBe("88.00");
  });

  it("interpolates between printed pairs, both ways", () => {
    expect(meritToPercentile(SCALE, 1000)).toBe(99.7);
    expect(meritToPercentile(SCALE, 5500)).toBeCloseTo(98.6, 5);
    expect(percentileToMerit(SCALE, 98.6)).toBe(5500);
    expect(percentileToMerit(SCALE, 99.7)).toBe(1000);
  });

  it("clamps outside the printed range and handles an empty scale", () => {
    expect(meritToPercentile(SCALE, 10)).toBe(99.98);
    expect(meritToPercentile(SCALE, 900000)).toBe(88.1);
    expect(percentileToMerit(SCALE, 99.999)).toBe(100);
    expect(percentileToMerit(SCALE, 5)).toBe(50000);
    expect(meritToPercentile([], 100)).toBeNull();
    expect(percentileToMerit([], 90)).toBeNull();
  });

  it("describes the gap as better or worse, higher percentile being better", () => {
    expect(describePercentileGap(96.5, 96.2).short).toBe("0.30 better");
    expect(describePercentileGap(95.9, 96.2).short).toBe("0.30 worse");
    expect(describePercentileGap(96.2, 96.2).short).toBe("same as closing");
    expect(describePercentileGap(99.995, 99.991).short).toBe("0.004 better");
  });
});
