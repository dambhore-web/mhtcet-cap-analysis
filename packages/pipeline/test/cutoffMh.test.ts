import { describe, expect, it } from "vitest";
import { MhCutoffParser } from "../src/parse/cutoffMh.ts";
import { line, w } from "./words.ts";

const chrome = [
  ...line(18, [447, "Government"], [509, "of"], [526, "Maharashtra"]),
  ...line(52, [314, "Cut"], [330, "Off"], [346, "List"], [365, "for"], [381, "Maharashtra"], [505, "CAP"], [525, "Round"], [554, "I"]),
];
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
