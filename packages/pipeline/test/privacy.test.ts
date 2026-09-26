import { describe, expect, it } from "vitest";
import { clusterLines, maskPersonalData } from "../src/layout.ts";
import { findPersonalData } from "../src/validate/report.ts";
import { line } from "./words.ts";

// Regression test for the layout-study tool (dumpPage): IDs and the name column must never be
// printed unmasked. Fake IDs and names only.
describe("maskPersonalData", () => {
  const words = [
    ...line(98, [33, "99001"], [68, "Test"], [93, "College"]),
    ...line(242, [46, "1"], [174, "EN99990001"], [242, "TESTNAME"], [290, "ALPHA"], [317, "BETA"], [416, "M"], [457, "OPEN"], [513, "GOPENS"]),
    ...line(244, [78, "555"], [115, "99.8737180"]),
    ...line(254, [242, "WRAPPEDNAME"]),
  ];
  const masked = maskPersonalData(words);
  const text = clusterLines(masked).map((l) => l.text).join("\n");

  it("hides application IDs and name words, including a wrapped name line", () => {
    expect(text).not.toMatch(/EN\d{8}/);
    for (const name of ["TESTNAME", "ALPHA", "BETA", "WRAPPEDNAME"]) expect(text).not.toContain(name);
    expect(findPersonalData(text)).toBe(false);
  });
  it("keeps the non-personal columns readable", () => {
    for (const keep of ["99001", "College", "555", "99.8737180", "M", "OPEN", "GOPENS"]) expect(text).toContain(keep);
  });
  it("does not modify the input words", () => {
    expect(words.some((w) => w.text === "EN99990001")).toBe(true);
  });
});
