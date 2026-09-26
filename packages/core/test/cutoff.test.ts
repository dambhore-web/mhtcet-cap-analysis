import { describe, expect, it } from "vitest";
import { computeCutoffs, roundNumber, toRound, type AllotmentRow } from "../src/index.ts";

const row = (merit: number | null, seatType: string | null, round: AllotmentRow["round"] = "I"): AllotmentRow => ({
  year: 2026, round, collegeCode: "99001", choiceCode: "9900112345", branch: "Test Branch", section: "State Level Seats",
  merit, score: 90, gender: "M", category: "OPEN", seatType,
});

describe("computeCutoffs", () => {
  it("takes the highest merit as closing and counts seats", () => {
    const out = computeCutoffs([row(10, "GOPENS"), row(250, "GOPENS"), row(40, "GOPENS"), row(7, "TFWS")]);
    expect(out.find((c) => c.seatType === "GOPENS")).toMatchObject({ closingMerit: 250, openingMerit: 10, seatsFilled: 3 });
    expect(out.find((c) => c.seatType === "TFWS")).toMatchObject({ closingMerit: 7, seatsFilled: 1 });
  });
  it("skips rows without merit or seat type and separates rounds", () => {
    const out = computeCutoffs([row(null, "GOPENS"), row(5, null), row(3, "GOPENS", "II")]);
    expect(out).toHaveLength(1);
    expect(out[0].round).toBe("II");
  });
  it("converts rounds", () => {
    expect(toRound(4)).toBe("IV");
    expect(roundNumber("III")).toBe(3);
    expect(() => toRound(9)).toThrow();
  });
});
