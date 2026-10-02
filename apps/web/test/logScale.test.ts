import { describe, expect, it } from "vitest";
import { logBounds, logScale, meritStep, roundMerit, tickLabel, ticksIn } from "../src/lib/logScale";

describe("logBounds", () => {
  it("snaps to the ticks around the values", () => {
    expect(logBounds([71, 8037])).toEqual([50, 10000]);
    expect(logBounds([12000])).toEqual([10000, 20000]);
  });
  it("widens a single tick to the next one", () => {
    expect(logBounds([1000])).toEqual([1000, 2000]);
  });
  it("ignores zero, negative and non-finite values", () => {
    expect(logBounds([0, -5, Number.NaN, 300])).toEqual([200, 500]);
    expect(logBounds([])).toEqual([10, 400000]);
  });
});

describe("logScale", () => {
  const x = logScale([100, 10000], 0, 200);
  it("maps the ends and the geometric middle", () => {
    expect(x(100)).toBe(0);
    expect(x(10000)).toBe(200);
    expect(x(1000)).toBeCloseTo(100);
  });
  it("clamps values outside the domain", () => {
    expect(x(5)).toBe(0);
    expect(x(1e6)).toBe(200);
  });
  it("inverts", () => {
    expect(x.invert(100)).toBeCloseTo(1000);
  });
});

describe("ticks and labels", () => {
  it("labels thousands as k", () => {
    expect(tickLabel(500)).toBe("500");
    expect(tickLabel(20000)).toBe("20k");
  });
  it("thins ticks on narrow charts but keeps the last", () => {
    expect(ticksIn([100, 10000])).toEqual([100, 200, 500, 1000, 2000, 5000, 10000]);
    expect(ticksIn([100, 5000], true)).toEqual([100, 500, 2000, 5000]);
  });
});

describe("merit rounding", () => {
  it("uses a step that suits the size", () => {
    expect(roundMerit(73.4)).toBe(73);
    expect(roundMerit(712)).toBe(710);
    expect(roundMerit(12004)).toBe(12000);
    expect(roundMerit(45123)).toBe(45100);
    expect(roundMerit(0.2)).toBe(1);
  });
  it("steps the pin by keyboard", () => {
    expect(meritStep(500)).toBe(10);
    expect(meritStep(12000)).toBe(100);
    expect(meritStep(30000)).toBe(500);
    expect(meritStep(12000, true)).toBe(1000);
  });
});
