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

  describe("All India list: JEE candidates rank ahead of every MHT-CET candidate", () => {
    const ai = (round: CutoffRow["round"], closingMerit: number, closingPercentile: number, exam: string): CutoffRow => ({
      ...row(round, closingMerit, closingPercentile), list: "AI", exam, section: "AI to AI", seatType: "AI",
    });
    const jeeStudent = (percentile: number): CandidateProfile => ({ ...student({ percentile }), candidature: "AI" });

    it("is within a row whose last admitted student came from MHT-CET, whatever the JEE percentile", () => {
      // MHT-CET 99.2 would beat a JEE 85 on raw numbers; on the AI list the JEE student ranks first
      const best = rankFind(jeeStudent(85), college, [ai("I", 99_500, 99.2, "MHT-CET")]).best;
      expect(best).toMatchObject({ status: "round-I", closingMerit: 99_500, closingPercentile: null });
    });

    it("still compares JEE percentiles on JEE rows", () => {
      const rows = [ai("I", 20_000, 97.1, "JEE"), ai("II", 30_000, 95.4, "JEE(Main)-2026")];
      expect(rankFind(jeeStudent(96), college, rows).best).toMatchObject({ status: "later-round", round: "II", closingPercentile: 95.4 });
      expect(rankFind(jeeStudent(90), college, rows).best).toMatchObject({ status: "out-of-range", closingPercentile: 95.4 });
    });

    it("hides MHT-CET percentiles from the round closings shown to a JEE student", () => {
      const rows = [ai("I", 20_000, 97.1, "JEE"), ai("IV", 101_000, 98.9, "MHT-CET")];
      const res = rankFind(jeeStudent(90), college, rows);
      expect(res.best).toMatchObject({ status: "later-round", round: "IV", closingPercentile: null });
      expect(res.best?.rounds.map((r) => r.closingPercentile)).toEqual([97.1, null]);
    });

    it("gives the same answer as the All India merit number for every row", () => {
      const rows = [ai("I", 20_000, 97.1, "JEE"), ai("II", 99_000, 99.0, "MHT-CET")];
      // a JEE student at 96.0 sits between merit 20,000 and the end of the JEE block (~98,000)
      expect(rankFind(jeeStudent(96), college, rows).best?.status).toBe(
        rankFind({ ...jeeStudent(96), percentile: null, meritNumber: 40_000 }, college, rows).best?.status,
      );
    });
  });
});
