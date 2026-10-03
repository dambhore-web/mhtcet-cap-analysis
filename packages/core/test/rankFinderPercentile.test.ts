import { describe, expect, it } from "vitest";
import { rankFind, type CandidateProfile, type CollegeEligibilityContext, type CutoffRow } from "../src/index.ts";

/** Each row prints the last admitted candidate's merit number and percentile. */
function row(round: CutoffRow["round"], closingMerit: number, closingPercentile: number | null): CutoffRow {
  return {
    authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH", round,
    choiceCode: "1600612345", collegeCode: "16006", section: "State Level", seatType: "GOPENS", stage: "I",
    closingMerit, closingPercentile, sourceFile: "test.pdf", sourcePage: 1,
  };
}

const student = (by: { merit?: number; percentile?: number }): CandidateProfile => ({
  candidature: "MH", homeUniversity: null, category: null, gender: "M",
  ews: false, tfws: false, defence: false, pwd: false, orphan: false, minorityCommunity: null,
  meritNumber: by.merit ?? 0, percentile: by.percentile ?? null, subjectGroup: "PCM",
});
const college: CollegeEligibilityContext = { homeUniversity: null, minorityCommunity: null };
const rows = [row("I", 4000, 97.5), row("II", 5000, 96.8), row("III", 5600, 96.3)];

describe("rankFind by percentile", () => {
  it("round-I when the percentile is at or above Round I's closing percentile", () => {
    expect(rankFind(student({ percentile: 97.5 }), college, rows).best).toMatchObject({
      status: "round-I", round: "I", closingMerit: 4000, closingPercentile: 97.5,
    });
  });

  it("later-round when it reaches only a later round's closing percentile", () => {
    expect(rankFind(student({ percentile: 96.5 }), college, rows).best).toMatchObject({
      status: "later-round", round: "III", closingPercentile: 96.3,
    });
  });

  it("out-of-range below every round, showing the loosest closing", () => {
    expect(rankFind(student({ percentile: 90 }), college, rows).best).toMatchObject({
      status: "out-of-range", round: "III", closingMerit: 5600, closingPercentile: 96.3,
    });
  });

  it("gives the same answer as the merit number of the same student", () => {
    for (const [merit, pct] of [[3900, 97.6], [4800, 97.0], [5500, 96.4], [9000, 92]] as const) {
      const a = rankFind(student({ merit }), college, rows).best!;
      const b = rankFind(student({ percentile: pct }), college, rows).best!;
      expect([b.status, b.round]).toEqual([a.status, a.round]);
    }
  });

  it("can't match by percentile on a row that prints none", () => {
    const best = rankFind(student({ percentile: 99.9 }), college, [row("I", 4000, null)]).best;
    expect(best?.status).toBe("out-of-range");
  });

  it("every round keeps its closing percentile", () => {
    const best = rankFind(student({ merit: 100 }), college, rows).best!;
    expect(best.rounds.map((r) => [r.round, r.closingPercentile])).toEqual([["I", 97.5], ["II", 96.8], ["III", 96.3]]);
  });
});
