import { describe, expect, it } from "vitest";
import { rankFind, normalizeStage, type CandidateProfile, type CollegeEligibilityContext, type CutoffRow } from "../src/index.ts";

const BASE_ROW: Omit<CutoffRow, "round" | "seatType" | "closingMerit" | "section" | "stage"> = {
  authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH",
  choiceCode: "1600612345", collegeCode: "16006",
  closingPercentile: null, sourceFile: "test.pdf", sourcePage: 1,
};

function mhRow(
  seatType: string,
  closingMerit: number,
  round: CutoffRow["round"] = "I",
  section = "State Level",
  stage = "I",
): CutoffRow {
  return { ...BASE_ROW, seatType, closingMerit, round, section, stage };
}

const openMale: CandidateProfile = {
  candidature: "MH", homeUniversity: "Savitribai Phule Pune University",
  category: null, gender: "M",
  ews: false, tfws: false, defence: false, pwd: false, orphan: false,
  minorityCommunity: null, meritNumber: 5000, subjectGroup: "PCM",
};

const autoCollege: CollegeEligibilityContext = { homeUniversity: null, minorityCommunity: null };

describe("rankFind", () => {
  it("returns null best when no cutoff rows exist for eligible seat types", () => {
    const result = rankFind(openMale, autoCollege, []);
    expect(result.best).toBeNull();
    expect(result.options).toHaveLength(0);
  });

  it("round-I: merit ≤ Round I closing", () => {
    const rows = [mhRow("GOPENS", 6000)];
    const result = rankFind(openMale, autoCollege, rows);
    expect(result.best).toMatchObject({ status: "round-I", round: "I", closingMerit: 6000, seatType: "GOPENS" });
  });

  it("later-round: merit > Round I but ≤ max later-round closing", () => {
    const rows = [
      mhRow("GOPENS", 4000, "I"),
      mhRow("GOPENS", 5500, "II"),
    ];
    const result = rankFind(openMale, autoCollege, rows);
    expect(result.best).toMatchObject({ status: "later-round", round: "II", closingMerit: 5500 });
  });

  it("later-round: names the round with the highest closing, even if not the last round", () => {
    const rows = [
      mhRow("GOPENS", 4000, "I"),
      mhRow("GOPENS", 5500, "II"),
      mhRow("GOPENS", 5200, "III"),
    ];
    const result = rankFind(openMale, autoCollege, rows);
    expect(result.best).toMatchObject({ status: "later-round", round: "II", closingMerit: 5500 });
  });

  it("out-of-range: merit exceeds all closings; shows loosest", () => {
    const rows = [
      mhRow("GOPENS", 3000, "I"),
      mhRow("GOPENS", 4000, "II"),
    ];
    const result = rankFind({ ...openMale, meritNumber: 5000 }, autoCollege, rows);
    expect(result.best).toMatchObject({ status: "out-of-range", round: "II", closingMerit: 4000 });
  });

  it("does not carry Round I value when seat type is absent from Round I", () => {
    // Round I row exists for GOPENS but not TFWS; TFWS only appears Round II
    const rows = [
      mhRow("GOPENS", 3000, "I"),
      mhRow("TFWS", 6000, "II"),
    ];
    const candidate = { ...openMale, meritNumber: 5000, tfws: true };
    const result = rankFind(candidate, autoCollege, rows);
    const tfwsOpt = result.options.find((o) => o.seatType === "TFWS");
    expect(tfwsOpt).toMatchObject({ status: "later-round", round: "II", closingMerit: 6000 });
  });

  it("best is the most favourable status across eligible seat types", () => {
    // GOPENS out of range; LOPENS (ladies, Stage II for male) also out; TFWS qualifies in Round I
    const rows = [
      mhRow("GOPENS", 3000, "I"),
      mhRow("TFWS", 6000, "I"),
    ];
    const candidate = { ...openMale, meritNumber: 5000, tfws: true };
    const result = rankFind(candidate, autoCollege, rows);
    expect(result.best?.seatType).toBe("TFWS");
    expect(result.best?.status).toBe("round-I");
  });

  it("filters by section: HU rows not matched at State Level section", () => {
    const huSection = "Home University Seats Allotted to Home University Candidates";
    const rows = [mhRow("GOPENH", 6000, "I", huSection)];
    // autoCollege has no HU → only S levels eligible, not H
    const result = rankFind(openMale, autoCollege, rows);
    expect(result.best).toBeNull();
  });

  it("H seats match when candidate is at same-HU college", () => {
    const huSection = "Home University Seats Allotted to Home University Candidates";
    const rows = [mhRow("GOPENH", 6000, "I", huSection)];
    const sameHU: CollegeEligibilityContext = { homeUniversity: "Savitribai Phule Pune University", minorityCommunity: null };
    const result = rankFind(openMale, sameHU, rows);
    expect(result.best).toMatchObject({ status: "round-I", seatType: "GOPENH" });
  });

  it("male stage-II ladies seat: only matches rows with stage II", () => {
    const stageIRow = mhRow("LOPENS", 6000, "I", "State Level", "I");
    const stageIIRow = mhRow("LOPENS", 5500, "I", "State Level", "II");
    const candidate = { ...openMale, meritNumber: 5000 };

    // Only Stage II row present → male candidate qualifies
    const r1 = rankFind(candidate, autoCollege, [stageIIRow]);
    expect(r1.best).toMatchObject({ status: "round-I", seatType: "LOPENS" });

    // Stage I row only → not matched for male
    const r2 = rankFind(candidate, autoCollege, [stageIRow]);
    expect(r2.best).toBeNull();
  });

  it("female candidate matches ladies seats on stage I", () => {
    const stageIRow = mhRow("LOPENS", 6000, "I", "State Level", "I");
    const result = rankFind({ ...openMale, gender: "F", meritNumber: 5000 }, autoCollege, [stageIRow]);
    expect(result.best).toMatchObject({ status: "round-I", seatType: "LOPENS" });
  });

  it("AI candidate matches only AI rows", () => {
    const aiRow: CutoffRow = {
      ...BASE_ROW, list: "AI", seatType: "AI", closingMerit: 8000, round: "I",
      section: "AI to AI", stage: "",
    };
    const mhRowData = mhRow("GOPENS", 4000, "I");
    const aiCandidate: CandidateProfile = { ...openMale, candidature: "AI", meritNumber: 7000 };
    const result = rankFind(aiCandidate, autoCollege, [aiRow, mhRowData]);
    expect(result.best).toMatchObject({ status: "round-I", seatType: "AI" });
    expect(result.options).toHaveLength(1);
  });

  it("out-of-range when later-round closing also missed", () => {
    const rows = [
      mhRow("GOPENS", 4000, "I"),
      mhRow("GOPENS", 4800, "II"),
    ];
    const result = rankFind({ ...openMale, meritNumber: 5000 }, autoCollege, rows);
    expect(result.best).toMatchObject({ status: "out-of-range", closingMerit: 4800 });
  });

  it("returns an entry per eligible seat type that has data", () => {
    const rows = [
      mhRow("GOPENS", 6000, "I"),
      mhRow("GOBCS", 7000, "I"),
    ];
    const candidate = { ...openMale, category: "OBC" as const, meritNumber: 5000 };
    const result = rankFind(candidate, autoCollege, rows);
    const types = result.options.map((o) => o.seatType);
    expect(types).toContain("GOPENS");
    expect(types).toContain("GOBCS");
  });

  it('matches a row whose stage is "I-Non PWD" as Stage I', () => {
    const rows = [mhRow("GOPENS", 6000, "I", "State Level", "I-Non PWD")];
    const result = rankFind(openMale, autoCollege, rows);
    expect(result.best).toMatchObject({ status: "round-I", closingMerit: 6000 });
  });

  it('matches a row whose stage is "I-Non Defence" as Stage I', () => {
    const rows = [mhRow("GOPENS", 6000, "I", "State Level", "I-Non Defence")];
    const result = rankFind(openMale, autoCollege, rows);
    expect(result.best).toMatchObject({ status: "round-I", closingMerit: 6000 });
  });

  it('does not match rows with unknown stage code "VII"', () => {
    const rows = [mhRow("GOPENS", 6000, "I", "State Level", "VII")];
    const result = rankFind(openMale, autoCollege, rows);
    expect(result.best).toBeNull();
  });
});

// ─── normalizeStage ───────────────────────────────────────────────────────────

describe("normalizeStage", () => {
  it('passes canonical values through', () => {
    expect(normalizeStage("I")).toBe("I");
    expect(normalizeStage("II")).toBe("II");
  });

  it('normalises "I-Non …" variants to "I"', () => {
    expect(normalizeStage("I-Non PWD")).toBe("I");
    expect(normalizeStage("I-Non Defence")).toBe("I");
    expect(normalizeStage("I-Non EWS")).toBe("I");
  });

  it('normalises "II-Non …" variants to "II"', () => {
    expect(normalizeStage("II-Non PWD")).toBe("II");
    expect(normalizeStage("II-Non Defence")).toBe("II");
  });

  it("leaves unknown codes unchanged", () => {
    expect(normalizeStage("VII")).toBe("VII");
    expect(normalizeStage("MH")).toBe("MH");
    expect(normalizeStage("")).toBe("");
  });
});

describe("rankFind reuses its summary of a rows array", () => {
  const rows: CutoffRow[] = [
    { authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH", round: "I", choiceCode: "0100100000", collegeCode: "01001", section: "State Level", seatType: "GOPENS", stage: "I", closingMerit: 1000, closingPercentile: null, sourceFile: "cutoff-list-round-I.pdf", sourcePage: 1 },
    { authority: "MH-CET-CELL", exam: "MHT-CET", year: 2026, list: "MH", round: "III", choiceCode: "0100100000", collegeCode: "01001", section: "State Level", seatType: "GOPENS", stage: "I", closingMerit: 1600, closingPercentile: null, sourceFile: "cutoff-list-round-I.pdf", sourcePage: 1 },
  ];
  const college = { homeUniversity: null, minorityCommunity: null };
  const candidate = (meritNumber: number): CandidateProfile => ({
    candidature: "MH", homeUniversity: null, category: null, gender: "M", ews: false, tfws: false, defence: false,
    pwd: false, orphan: false, minorityCommunity: null, meritNumber, subjectGroup: "PCM",
  });

  it("gives each merit number its own status on the same rows", () => {
    expect(rankFind(candidate(900), college, rows).best?.status).toBe("round-I");
    expect(rankFind(candidate(1500), college, rows).best).toMatchObject({ status: "later-round", round: "III", closingMerit: 1600 });
    expect(rankFind(candidate(5000), college, rows).best).toMatchObject({ status: "out-of-range", round: "III", closingMerit: 1600 });
  });

  it("accepts a precomputed eligible list with the same result", () => {
    const eligible = ["GOPENS", "LOPENS"];
    expect(rankFind(candidate(1500), college, rows, eligible)).toEqual(rankFind(candidate(1500), college, rows));
  });
});
