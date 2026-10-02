import { describe, expect, it } from "vitest";
import { isOpenSeat, seatTypeLabel, seatTypeParts, seatTypeShortLabel, seatTypeSortKey } from "../src/lib/seatType";

describe("seatTypeLabel", () => {
  it("reads quota, category and level", () => {
    expect(seatTypeLabel("GOPENS")).toBe("General open, state level");
    expect(seatTypeLabel("GOPENH")).toBe("General open, home university");
    expect(seatTypeLabel("LOPENS")).toBe("Ladies open, state level");
    expect(seatTypeLabel("GOBCO")).toBe("General OBC, other than home university");
  });

  it("maps NT1/NT2/NT3 to NT-B/NT-C/NT-D", () => {
    expect(seatTypeLabel("GNT1S")).toBe("General NT-B, state level");
    expect(seatTypeLabel("LNT2H")).toBe("Ladies NT-C, home university");
    expect(seatTypeLabel("GNT3O")).toBe("General NT-D, other than home university");
  });

  it("handles multi-letter quotas and standalone codes", () => {
    expect(seatTypeLabel("PWDROBCS")).toBe("Disability (PWD), common OBC, state level");
    expect(seatTypeLabel("DEFOPENS")).toBe("Defence open, state level");
    expect(seatTypeLabel("TFWS")).toBe("Tuition fee waiver (TFWS)");
    expect(seatTypeLabel("EWS")).toBe("Economically weaker section (EWS)");
  });

  it("returns unknown codes unchanged", () => {
    expect(seatTypeLabel("XYZ")).toBe("XYZ");
  });
});

describe("seatTypeShortLabel", () => {
  it("abbreviates the level", () => {
    expect(seatTypeShortLabel("GOPENS")).toBe("General open");
    expect(seatTypeShortLabel("GOPENH")).toBe("General open (HU)");
    expect(seatTypeShortLabel("LSCO")).toBe("Ladies SC (OHU)");
    expect(seatTypeShortLabel("TFWS")).toBe("TFWS (fee waiver)");
  });
});

describe("seatTypeSortKey", () => {
  it("orders general before ladies, open before reserved, state before home", () => {
    const codes = ["TFWS", "LOPENS", "GOBCS", "GOPENH", "GOPENS"];
    expect([...codes].sort((a, b) => seatTypeSortKey(a) - seatTypeSortKey(b))).toEqual([
      "GOPENS",
      "GOPENH",
      "GOBCS",
      "LOPENS",
      "TFWS",
    ]);
  });
});

describe("isOpenSeat", () => {
  it("is true only for general and ladies open seats", () => {
    expect(isOpenSeat("GOPENS")).toBe(true);
    expect(isOpenSeat("LOPENH")).toBe(true);
    expect(isOpenSeat("GOBCS")).toBe(false);
    expect(isOpenSeat("DEFOPENS")).toBe(false);
  });
});

describe("seatTypeParts", () => {
  it("splits a reserved code into quota, category and level", () => {
    expect(seatTypeParts("gobcs")).toEqual([
      { code: "G", part: "Quota", meaning: "General" },
      { code: "OBC", part: "Category", meaning: "OBC" },
      { code: "S", part: "Level", meaning: "State level" },
    ]);
    expect(seatTypeParts("PWDRSCS")?.map((p) => p.code)).toEqual(["PWDR", "SC", "S"]);
    expect(seatTypeParts("LOPENH")?.[1].meaning).toBe("Open (general)");
  });
  it("keeps standalone codes whole and rejects others", () => {
    expect(seatTypeParts("TFWS")).toEqual([{ code: "TFWS", part: "Special seat", meaning: "Tuition fee waiver (TFWS)" }]);
    expect(seatTypeParts("XYZ")).toBeNull();
  });
});
