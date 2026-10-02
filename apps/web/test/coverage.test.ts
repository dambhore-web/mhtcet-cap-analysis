import { describe, expect, it } from "vitest";
import type { ListItem } from "../src/lib/list";
import { coverageChecks, listCoverage } from "../src/lib/optionForm";

const item = (college: string, branch: string, first: number, last: number): ListItem => ({
  id: `${college}-${branch}`,
  choiceCode: `${college}01910`,
  collegeCode: college,
  collegeName: college,
  branch,
  seatType: "GOPENS",
  closingMerit: last,
  year: 2026,
  firstRoundClosing: first,
  lastRoundClosing: last,
});

const DISTRICT: Record<string, string> = { A: "Pune", B: "Pune", C: "Pune", D: "Pune", E: "Pune", F: "Mumbai" };
const districtOf = (code: string) => DISTRICT[code] ?? null;

describe("listCoverage (#137)", () => {
  const list = [
    item("A", "Computer Engineering", 4000, 5000), // likely at 3,000
    item("B", "Information Technology", 2000, 3500), // target
    item("C", "Artificial Intelligence (AI) and Data Science", 2000, 2800), // reach: 3,000 ≤ 2,800 × 1.1
    item("D", "Computer Science and Engineering", 1000, 1500), // out
    item("E", "Mechanical Engineering", 9000, 9500), // likely
    item("X", "Civil Engineering", 9000, 9500), // likely, district unknown
  ];

  it("counts bands with the Find tiles' rule", () => {
    expect(listCoverage(list, 3000).bands).toEqual({ likely: 3, target: 1, reach: 1, out: 1 });
    expect(listCoverage(list, null).bands).toBeNull();
  });

  it("counts branch groups and the largest one's share", () => {
    const c = listCoverage(list, 3000);
    expect(c.groups.distinct).toBe(3);
    expect(c.groups.top).toEqual({ name: "Computer & IT", count: 4, share: 4 / 6 });
    expect(c.size).toBe(6);
    expect(c.max).toBe(300);
  });

  it("counts districts over the choices whose district is known", () => {
    const c = listCoverage(list, 3000, districtOf);
    expect(c.districts).toEqual({ distinct: 1, known: 5, top: { name: "Pune", count: 5, share: 1 } });
    expect(listCoverage(list, 3000).districts).toBeNull();
  });
});

describe("coverageChecks (#137)", () => {
  const cs = (college: string) => item(college, "Computer Engineering", 4000, 5000);

  it("suggests neighbouring branches when more than 80% are one group", () => {
    const checks = coverageChecks(listCoverage([cs("A"), cs("B"), cs("C"), cs("D"), cs("E")], 3000));
    expect(checks.map((c) => c.text).join(" ")).toMatch(/100% of your choices are Computer & IT branches\. If Electronics & Telecom branches are acceptable to you/);
  });

  it("stays quiet at exactly 80% and for short lists", () => {
    const mixed = [cs("A"), cs("B"), cs("C"), cs("D"), item("E", "Civil Engineering", 9000, 9500)];
    expect(coverageChecks(listCoverage(mixed, 3000)).some((c) => /branches/.test(c.text))).toBe(false);
    expect(coverageChecks(listCoverage([cs("A"), cs("B")], 3000))).toEqual([]);
  });

  it("mentions a single district only once the list is long enough, as a suggestion", () => {
    const checks = coverageChecks(listCoverage([cs("A"), cs("B"), cs("C"), cs("D"), item("E", "Civil Engineering", 1, 2)], 3000, districtOf));
    expect(checks.some((c) => /All your choices are in Pune district\. That's fine if you want to study there/.test(c.text))).toBe(true);
    const spread = [cs("A"), cs("B"), cs("C"), cs("D"), cs("F")];
    expect(coverageChecks(listCoverage(spread, 3000, districtOf)).some((c) => /district/.test(c.text))).toBe(false);
  });

  it("never orders and never says safe", () => {
    const text = coverageChecks(listCoverage([cs("A"), cs("B"), cs("C"), cs("D"), cs("E")], 3000, districtOf)).map((c) => c.text).join(" ");
    expect(text).not.toMatch(/\b(must|should|safe)\b/i);
  });
});
