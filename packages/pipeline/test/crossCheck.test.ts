import { describe, expect, it } from "vitest";
import type { AllotmentRow, CutoffRow } from "@mhtcet/core";
import { crossCheck, newInRound, normaliseChoiceCode } from "../src/validate/crossCheck.ts";

const a = (round: AllotmentRow["round"], merit: number, seatType: string, choiceCode = "9900119110"): AllotmentRow => ({
  year: 2026, round, collegeCode: "99001", choiceCode, branch: "B", section: "State Level Seats",
  merit, score: 90, gender: "M", category: "OPEN", seatType,
});
const o = (round: CutoffRow["round"], seatType: string, closingMerit: number, stage = "I"): CutoffRow => ({
  authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH", round, collegeCode: "99001", choiceCode: "9900119110",
  section: "State Level", seatType, stage, closingMerit, closingPercentile: 90, sourceFile: "f.pdf", sourcePage: 1,
});

describe("crossCheck", () => {
  it("normalises TFWS choice codes", () => {
    expect(normaliseChoiceCode("1600619111T")).toBe("1600619110");
    expect(normaliseChoiceCode("0600721971UT")).toBe("0600721970U");
    expect(normaliseChoiceCode("1600619110")).toBe("1600619110");
  });
  it("uses only rows new in a round and the worst stage of the official list", () => {
    const allot = [
      a("I", 100, "GOPENS"), a("I", 200, "GOPENS"),
      a("II", 100, "GOPENS"), a("II", 200, "GOPENS"), a("II", 150, "GOPENS"),
      a("I", 50, "TFWS", "9900119111T"),
    ];
    expect(newInRound(allot)).toHaveLength(4);
    const res = crossCheck(allot, [o("I", "GOPENS", 190), o("I", "GOPENS", 200, "II"), o("II", "GOPENS", 150), o("I", "TFWS", 50)], "99001");
    expect(res.map((r) => [r.round, r.seatType, r.status])).toEqual([
      ["I", "GOPENS", "match"], ["II", "GOPENS", "match"], ["I", "TFWS", "match"],
    ]);
  });
  it("reports both kinds of missing values", () => {
    const res = crossCheck([a("I", 10, "GSCS")], [o("I", "GOPENS", 5)], "99001");
    expect(res.map((r) => r.status).sort()).toEqual(["missing-computed", "missing-official"]);
  });
});
