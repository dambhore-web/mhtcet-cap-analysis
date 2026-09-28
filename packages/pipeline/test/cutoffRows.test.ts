import { describe, expect, it } from "vitest";
import { AI_LAYOUT, AI_LAYOUT_2023, DIPLOMA_LAYOUT, DIPLOMA_LAYOUT_2023, RowListParser } from "../src/parse/cutoffRows.ts";
import { line } from "./words.ts";

describe("RowListParser (All India list)", () => {
  const p = new RowListParser(AI_LAYOUT);
  p.addPage([
    ...line(42, [193, "Cut"], [207, "Off"], [222, "List"], [240, "for"], [254, "All"], [269, "India"], [322, "CAP"], [340, "Round"], [367, "-"], [377, "II"]),
    // record 1: words spread over several y positions, as printed
    ...line(130, [58, "1"], [232, "99001"], [253, "-"], [260, "Test"], [525, "Computer"]),
    ...line(132, [90, "15943"], [112, "(86.5868550)"], [174, "9900124210"], [784, "AI"]),
    ...line(134, [655, "JEE"], [716, "AI"], [725, "to"], [735, "AI"]),
    // record 2: thousands separator in Sr. No, MH seat type in the seat-type column
    ...line(156, [49, "1,000"], [232, "99001"], [776, "GNT2H"]),
    ...line(158, [88, "233737"], [114, "(11.5237873)"], [174, "9900126310"]),
    ...line(160, [634, "JEE(Main)-2026"], [714, "MH"], [725, "to"], [736, "AI"]),
  ]);
  it("anchors each record on its choice code and reads every column", () => {
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]).toMatchObject({ srNo: 1, collegeCode: "99001", choiceCode: "9900124210", closingMerit: 15943, closingPercentile: 86.586855, exam: "JEE", type: "AI to AI", seatType: "AI" });
    expect(p.rows[1]).toMatchObject({ srNo: 1000, closingMerit: 233737, exam: "JEE(Main)-2026", type: "MH to AI", seatType: "GNT2H" });
    expect([...p.titleRounds]).toEqual(["II"]);
  });
  it("flags serial-number gaps", () => {
    expect(p.checkSerials()).toEqual(["row 2: Sr. No 1000 (9900126310, page 1)"]);
  });
});

describe("RowListParser (Diploma list 2026)", () => {
  it("reads rows without type or seat-type columns", () => {
    const p = new RowListParser(DIPLOMA_LAYOUT);
    p.addPage([...line(128, [58, "1"]), ...line(130, [98, "239636"], [123, "(65.89)"], [174, "9900129310"], [691, "Diploma/"], [730, "D.voc"])]);
    expect(p.rows[0]).toMatchObject({ srNo: 1, collegeCode: "99001", closingMerit: 239636, closingPercentile: 65.89, exam: "Diploma/ D.voc", type: null, seatType: null });
  });
});

describe("RowListParser (Diploma list 2023 — narrow layout, 9-digit choice codes)", () => {
  it("anchors on choice code at x≈119 and extracts 4-digit college code", () => {
    const p = new RowListParser(DIPLOMA_LAYOUT_2023);
    // Mirrors the actual 2023 Diploma PDF column positions
    p.addPage([
      ...line(185, [22, "Sr.No"], [55, "CutOff"], [84, "Merit"], [117, "Choice"], [148, "Code"], [675, "Qualfing"], [716, "Exam"]),
      ...line(210, [30, "1"], [51, "143265"], [80, "(84.42)"], [119, "428519110"], [675, "Diploma/D.Voc."]),
    ]);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ srNo: 1, collegeCode: "4285", choiceCode: "428519110", closingMerit: 143265, closingPercentile: 84.42, exam: "Diploma/D.Voc.", type: null, seatType: null });
  });
});

describe("RowListParser (AI list 2023 — seatType at x=758, type starts at x=690)", () => {
  it("captures seatType and full type string with the shifted 2023 windows", () => {
    const p = new RowListParser(AI_LAYOUT_2023);
    p.addPage([
      // Mirrors Round I layout: seatType "AI" at x=758, type "AI to AI" at x=690,699,709
      ...line(128, [96, "98"], [107, "(99.7006242)"], [758, "AI"]),
      ...line(129, [176, "600624510"], [630, "JEE(Main)"], [690, "AI"], [699, "to"], [709, "AI"]),
    ]);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ collegeCode: "6006", choiceCode: "600624510", closingMerit: 98, seatType: "AI", exam: "JEE(Main)", type: "AI to AI" });
  });
});
