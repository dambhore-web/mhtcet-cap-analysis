import { describe, expect, it } from "vitest";
import { AllotmentParser } from "../src/parse/allotment.ts";
import { line, w } from "./words.ts";

// Synthetic page shaped like a 2026 allotment list. IDs and names are fake.
const seatLine = (y: number, cap: string) =>
  line(y, [28, "Sanction"], [66, "Intake:"], [97, cap], [132, "CAP"], [151, "Seats:"], [187, cap], [215, "["], [221, "MS"], [235, "Seats:"], [268, cap], [293, "Minority"], [330, "Seats"], [355, ":"], [367, "0"], [392, "AI"], [404, "Seats:"], [439, "0"], [462, "]"]);

const page = [
  ...line(98, [33, "99001"], [68, "Test"], [93, "College"]),
  ...line(116, [35, "9900119110"], [82, "-"], [91, "Civil"], [116, "Engineering"]),
  ...seatLine(154, "3"),
  ...line(180, [30, "State"], [56, "Level"], [81, "Seats"]),
  ...line(242, [46, "1"], [174, "EN99990001"], [242, "TESTNAME"], [290, "ALPHA"], [416, "M"], [457, "OPEN"], [513, "GOPENS"]),
  ...line(244, [78, "555"], [115, "99.8737180"]),
  // category text glued to the seat type by the PDF
  ...line(264, [46, "2"], [174, "EN99990002"], [242, "TESTNAME"], [416, "M"], [433, "NT"], [448, "2"]),
  w(458, 264, "(NT-C)$/DEF2DEFRNT2S"),
  ...line(266, [73, "1263"], [115, "99.7032870"]),
  ...line(286, [46, "3"], [242, "VACANT"], [513, "GSCS"]),
  ...line(306, [46, "4"], [174, "EN99990003"], [242, "TESTNAME"], [417, "F"], [460, "OPEN"], [513, "EWS"]),
  ...line(308, [73, "2000"], [115, "99.0000000"]),
  // a TFWS list starting mid-page
  ...line(340, [35, "9900119111T"], [87, "-"], [95, "Civil"], [121, "Engineering"]),
  ...seatLine(360, "1"),
  ...line(400, [46, "1"], [174, "EN99990004"], [242, "TESTNAME"], [416, "M"], [460, "OBC"], [513, "TFWS"]),
  ...line(402, [73, "3000"], [115, "98.5000000"]),
];

describe("AllotmentParser", () => {
  const p = new AllotmentParser(2026, "I", "99001");
  p.addPage(page);

  it("parses rows by column windows around the ID anchor", () => {
    expect(p.rows).toHaveLength(4);
    expect(p.rows[0]).toMatchObject({
      choiceCode: "9900119110", branch: "Civil Engineering", section: "State Level Seats",
      merit: 555, score: 99.873718, gender: "M", category: "OPEN", seatType: "GOPENS",
    });
  });
  it("splits a seat type glued to a multi-word category", () => {
    expect(p.rows[1]).toMatchObject({ merit: 1263, category: "NT 2 (NT-C)$/DEF2", seatType: "DEFRNT2S" });
  });
  it("files rows under the branch header above them on the same page", () => {
    expect(p.rows[3]).toMatchObject({ choiceCode: "9900119111T", seatType: "TFWS", merit: 3000 });
  });
  it("collects printed seat counts and VACANT rows for the CAP Seats check", () => {
    const b = p.branches.get("9900119110")!;
    expect(b).toMatchObject({ capSeats: 3, sanctionIntake: 3, msSeats: 3, aiSeats: 0, parsedRows: 3, vacantRows: 1 });
    expect(b.rowsBySeatType).toEqual({ GOPENS: 1, DEFRNT2S: 1, EWS: 1 });
    expect(b.vacantBySeatType).toEqual({ GSCS: 1 });
    expect(p.branches.get("9900119111T")).toMatchObject({ capSeats: 1, parsedRows: 1 });
  });
  it("never outputs names or application IDs", () => {
    const out = JSON.stringify([p.rows, [...p.branches.values()]]);
    expect(out).not.toMatch(/EN\d{8}/);
    expect(out).not.toContain("TESTNAME");
    expect(out).not.toContain("ALPHA");
  });
});
