import { describe, expect, it } from "vitest";
import { checkMeritList, parseMeritPage, type MeritParseIssue } from "../src/parse/merit.ts";
import { line } from "./words.ts";

// Fake IDs and names.
const page = [
  ...line(132, [56, "Merit"], [85, "Application"]),
  ...line(170, [64, "1"], [84, "EN99990001"], [130, "TESTNAME"], [160, "ALPHA"], [275, "JEE"], [313, "99.9917594"], [362, "99.98"]),
  ...line(180, [64, "2"], [84, "EN99990002"], [130, "TESTNAME"], [275, "JEE"], [313, "99.9913337"]),
  ...line(190, [130, "WRAPPEDNAME"]),
  ...line(200, [62, "3"], [84, "EN99990003"], [130, "TESTNAME"], [262, "MHT-CET-PCM"], [313, "99.9"]),
];

describe("parseMeritPage", () => {
  const issues: MeritParseIssue[] = [];
  const rows = parseMeritPage(page, 1, issues);
  it("reads merit, exam and score and ignores wrapped name lines", () => {
    expect(rows).toEqual([
      { merit: 1, exam: "JEE", score: 99.9917594 },
      { merit: 2, exam: "JEE", score: 99.9913337 },
      { merit: 3, exam: "MHT-CET-PCM", score: 99.9 },
    ]);
    expect(issues).toEqual([]);
  });
  it("keeps no names or IDs", () => {
    expect(JSON.stringify(rows)).not.toMatch(/EN\d{8}|TESTNAME/);
  });
});

describe("checkMeritList", () => {
  it("finds gaps, duplicates and score increases within an exam", () => {
    const c = checkMeritList([
      { merit: 1, exam: "JEE", score: 99 },
      { merit: 2, exam: "JEE", score: 99.5 },
      { merit: 4, exam: "MHT-CET-PCM", score: 99.9 },
      { merit: 4, exam: "MHT-CET-PCM", score: 99.9 },
    ]);
    expect(c.gaps).toEqual([3]);
    expect(c.duplicates).toBe(1);
    expect(c.jee).toEqual({ count: 2, first: 1, last: 2, contiguous: true });
    expect(c.monotoneViolations).toEqual([{ exam: "JEE", merit: 2, score: 99.5, previous: 99 }]);
  });
});
