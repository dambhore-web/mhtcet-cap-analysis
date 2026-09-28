import { describe, expect, it } from "vitest";
import { MhCutoffParser } from "../src/parse/cutoffMh.ts";
import { line, w } from "./words.ts";

const chrome = [
  ...line(18, [447, "Government"], [509, "of"], [526, "Maharashtra"]),
  ...line(52, [314, "Cut"], [330, "Off"], [346, "List"], [365, "for"], [381, "Maharashtra"], [505, "CAP"], [525, "Round"], [554, "I"]),
];

describe("MhCutoffParser (2023-style 4-digit college code)", () => {
  it("pads a 4-digit college code and 9-digit choice code to the 2026 form", () => {
    const p = new MhCutoffParser();
    p.addPage([
      ...chrome,
      ...line(85, [18, "1002"], [40, "-"], [49, "Test"], [80, "College"]),
      ...line(103, [18, "100219110"], [60, "-"], [68, "Civil"], [94, "Engineering"]),
      ...line(118, [20, "Status:"], [57, "Government"], [110, "Autonomous"]),
      ...line(136, [29, "State"], [54, "Level"]),
      ...line(162, [81, "GOPENS"], [136, "GSCS"]),
      w(40, 164, "Stage"),
      ...line(188, [47, "I"], [73, "45820"], [124, "54803"]),
      ...line(196, [73, "(80.7328826)"], [124, "(76.6166542)"]),
    ]);
    const cells = p.cells();
    expect(p.colleges.get("01002")?.name).toBe("Test College");
    expect(p.branches.get("0100219110")).toMatchObject({ collegeCode: "01002", name: "Civil Engineering" });
    expect(cells.find((c) => c.seatType === "GOPENS")).toMatchObject({ collegeCode: "01002", choiceCode: "0100219110", closingMerit: 45820 });
    expect(p.issues).toEqual([]);
  });
  it("stores normalised seat-type codes (ORPHAN→ORPHANN, PWDROBC→PWDROBCS)", () => {
    const p = new MhCutoffParser();
    p.addPage([
      ...chrome,
      ...line(85, [18, "1002"], [40, "-"], [49, "Test"], [80, "College"]),
      ...line(103, [18, "100219110"], [60, "-"], [68, "Test"], [94, "Branch"]),
      ...line(118, [20, "Status:"], [57, "Unaided"]),
      ...line(136, [29, "State"], [54, "Level"]),
      ...line(162, [81, "ORPHAN"], [195, "PWDROBC"]),
      w(40, 164, "Stage"),
      ...line(188, [47, "I"], [81, "111"], [195, "222"]),
      ...line(196, [81, "(90.0)"], [195, "(80.0)"]),
    ]);
    const cells = p.cells();
    const seatTypes = cells.map((c) => c.seatType).sort();
    expect(seatTypes).toEqual(["ORPHANN", "PWDROBCS"]);
    expect(p.issues).toEqual([]);
  });
});
const footer = [...line(764, [179, "Legends:"], [213, "Starting"]), ...line(816, [369, "1"])];

const page1 = [
  ...chrome,
  ...line(86, [18, "99001"], [45, "-"], [53, "Test"], [80, "College"]),
  ...line(104, [18, "9900112345"], [64, "-"], [73, "Test"], [99, "Engineering"]),
  ...line(114, [18, "(Wrapped)"]),
  ...line(122, [20, "Status:"], [57, "Un-Aided"], [110, "Home"], [131, "University"], [179, ":"], [186, "Test"], [207, "University"]),
  ...line(136, [29, "State"], [54, "Level"]),
  ...line(162, [83, "GOPENS"], [143, "GSCS"], [200, "TFWS"]),
  w(40, 164, "Stage"),
  ...line(188, [47, "I"], [73, "100"], [185, "300"]),
  ...line(196, [73, "(99.1234567)"], [185, "(97.5000000)"]),
  ...line(216, [46, "II"], [129, "5000"]),
  ...line(224, [129, "(80.0000000)"]),
  ...line(244, [40, "I-Non"], [73, "900"]),
  ...line(252, [73, "(90.5000000)"]),
  w(39, 254, "PWD"),
  ...footer,
];
// Continuation page: no title; the overflow column sits at the y of the table it extends.
const page2 = [...line(162, [29, "EWS"]), ...line(188, [20, "777"]), ...line(196, [20, "(95.0000000)"])];

describe("MhCutoffParser", () => {
  const p = new MhCutoffParser();
  p.addPage(page1);
  p.addPage(page2);
  const cells = p.cells();
  const get = (seatType: string, stage: string) => cells.find((c) => c.seatType === seatType && c.stage === stage);

  it("reads college, branch (with wrapped name) and status", () => {
    expect(p.colleges.get("99001")?.name).toBe("Test College");
    expect(p.branches.get("9900112345")).toMatchObject({ name: "Test Engineering (Wrapped)", status: "Un-Aided", homeUniversity: "Test University" });
    expect([...p.titleRounds]).toEqual(["I"]);
  });
  it("assigns values to header columns by position, leaving empty cells empty", () => {
    expect(get("GOPENS", "I")).toMatchObject({ closingMerit: 100, closingPercentile: 99.1234567, section: "State Level", choiceCode: "9900112345" });
    expect(get("TFWS", "I")).toMatchObject({ closingMerit: 300, closingPercentile: 97.5 });
    expect(get("GSCS", "I")).toBeUndefined();
    expect(get("GSCS", "II")).toMatchObject({ closingMerit: 5000, closingPercentile: 80 });
  });
  it("joins stage labels that wrap onto the percentile line", () => {
    expect(get("GOPENS", "I-Non PWD")).toMatchObject({ closingMerit: 900, closingPercentile: 90.5 });
  });
  it("attaches continuation-page columns to the table and stage they extend", () => {
    expect(get("EWS", "I")).toMatchObject({ closingMerit: 777, closingPercentile: 95, choiceCode: "9900112345", page: 2 });
  });
  it("reports no issues and ignores the footer", () => {
    expect(p.issues).toEqual([]);
    expect(cells).toHaveLength(5);
  });
});

describe("code normalisation", () => {
  it("pads college and choice codes to the 2026 form and keeps suffix letters", async () => {
    const { normaliseChoiceCode, normaliseCollegeCode } = await import("../src/parse/codes.ts");
    expect(normaliseCollegeCode("1002")).toBe("01002");
    expect(normaliseCollegeCode("16006")).toBe("16006");
    expect(normaliseChoiceCode("100219110")).toBe("0100219110");
    expect(normaliseChoiceCode("1600624210")).toBe("1600624210");
    expect(normaliseChoiceCode("100219110T")).toBe("0100219110T");
  });
  it("maps colleges whose code changed when they became universities", async () => {
    const { normaliseChoiceCode, normaliseCollegeCode } = await import("../src/parse/codes.ts");
    expect(normaliseCollegeCode("6006")).toBe("16006");
    expect(normaliseChoiceCode("0600624510")).toBe("1600624510");
    expect(normaliseChoiceCode("400550710")).toBe("1400550710");
  });
});
