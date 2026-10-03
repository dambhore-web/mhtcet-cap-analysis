import { describe, expect, it } from "vitest";
import { BAND_LABELS, REACH_MARGIN, bandOf } from "../src/bands.ts";

describe("bandOf (#136)", () => {
  it("maps Round I and later rounds to Likely and Target", () => {
    expect(bandOf("round-I", 5000, 6000)).toBe("likely");
    expect(bandOf("later-round", 7000, 7500)).toBe("target");
  });

  it("calls an out-of-range option Reach up to 10% worse than the closing", () => {
    expect(REACH_MARGIN).toBe(0.1);
    expect(bandOf("out-of-range", 10_500, 10_000)).toBe("reach");
    expect(bandOf("out-of-range", 11_000, 10_000)).toBe("reach"); // exactly 10% worse
    expect(bandOf("out-of-range", 11_001, 10_000)).toBe("out");
  });

  it("never labels anything 'safe'", () => {
    expect(Object.values(BAND_LABELS).join(" ")).not.toMatch(/safe/i);
  });
});
