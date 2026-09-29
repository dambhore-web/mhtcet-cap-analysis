import { describe, expect, it } from "vitest";
import { parseNirfPlacement, parseSalary, rowProblems, type PdfItem } from "../src/parse/nirf.ts";

/** Synthetic NIRF-style page: cells laid out on a grid of (row, col) in reading order. */
function page(cells: Array<[number, number, string]>, rotated: boolean, pageNo = 1): PdfItem[] {
  // Upright: text along +x, rows go down (y decreases). Rotated 90° (as NIRF prints): text along +y, rows go right (x increases).
  return cells.map(([row, col, str]) => ({
    page: pageNo,
    str,
    transform: rotated ? [0, 8, -8, 0, row, col] : [8, 0, 0, 8, col, 800 - row],
  }));
}

const header: Array<[number, number, string]> = [
  [10, 10, "Institute Name: Test Institute of Engineering [IR-E-C-99999]"],
  [300, 10, "UG [4 Years Program(s)]: Placement & higher studies for previous 3 years"],
  [315, 24, "Academic Year"], [315, 106, "No. of first year"], [322, 96, "students intake in the"], [315, 189, "No. of first year"],
  [315, 272, "Academic Year"], [315, 354, "No. of students"], [315, 437, "Academic Year"], [315, 519, "No. of students"],
  [322, 523, "graduating in"], [315, 602, "No. of students"], [322, 616, "placed"], [315, 683, "Median salary of"], [315, 767, "No. of students"],
];

function dataRow(r: number, ys: [string, string, string], v: [string, string, string, string, string, string, string]): Array<[number, number, string]> {
  return [
    [r, 13, ys[0]], [r, 96, v[0]], [r, 178, v[1]], [r, 261, ys[1]], [r, 343, v[2]],
    [r, 426, ys[2]], [r, 509, v[3]], [r, 591, v[4]], [r, 674, v[5]], [r, 756, v[6]],
  ];
}

const table: Array<[number, number, string]> = [
  ...header,
  ...dataRow(350, ["2019-20", "2020-21", "2022-23"], ["300", "298", "20", "310", "250", "500000(Five Lakhs", "12"]),
  [357, 674, "only)"],
  ...dataRow(370, ["2020-21", "2021-22", "2023-24"], ["300", "295", "18", "305", "260", "5.5 LPA", "9"]),
  ...dataRow(390, ["2021-22", "2022-23", "2024-25"], ["300", "300", "22", "312", "-", "-", "15"]),
  [430, 10, "PG [2 Years Program(s)]: Placement & higher studies for previous 3 years"],
  ...dataRow(460, ["2021-22", "2022-23", "2024-25"], ["60", "58", "0", "55", "40", "400000", "3"]),
];

const expected = [
  { graduationYear: "2022-23", graduates: 310, placed: 250, medianSalary: 500000, higherStudies: 12 },
  { graduationYear: "2023-24", graduates: 305, placed: 260, medianSalary: 550000, higherStudies: 9 },
  { graduationYear: "2024-25", graduates: 312, placed: null, medianSalary: null, higherStudies: 15 },
];

describe("NIRF UG 4-year placement table", () => {
  it("reads the table on a rotated page (as NIRF prints it)", () => {
    const r = parseNirfPlacement(page(table, true));
    expect(r.instituteId).toBe("IR-E-C-99999");
    expect(r.instituteName).toBe("Test Institute of Engineering");
    expect(r.rows).toEqual(expected);
  });

  it("reads the same table on an upright page", () => {
    expect(parseNirfPlacement(page(table, false)).rows).toEqual(expected);
  });

  it("stops at the PG table and ignores its rows", () => {
    const rows = parseNirfPlacement(page(table, true)).rows;
    expect(rows.every((r) => r.graduates !== 55)).toBe(true);
  });

  it("returns no rows when the UG 4-year table is missing", () => {
    const r = parseNirfPlacement(page([header[0], [300, 10, "PG [2 Years Program(s)]: Placement & higher studies"]], true));
    expect(r.rows).toEqual([]);
  });

  it("reads salaries as typed by institutions", () => {
    expect(parseSalary("1000000(Ten Lakhs)")).toBe(1000000);
    expect(parseSalary("10,00,000")).toBe(1000000);
    expect(parseSalary("550000.00")).toBe(550000);
    expect(parseSalary("4.8 Lakhs")).toBe(480000);
    expect(parseSalary("1120000(Eleven lakhs twenty thousand)")).toBe(1120000);
    expect(parseSalary("2503541 (Twenty Five Lakh Three Thousand)")).toBe(2503541);
    expect(parseSalary("1000000(Ten Lacks )")).toBe(1000000);
    // digits and words disagree: a typo, so neither is used
    expect(parseSalary("3000000(Three lakhs)")).toBeNull();
    expect(parseSalary("-")).toBeNull();
    expect(parseSalary("0")).toBeNull();
  });

  it("flags rows that cannot be right", () => {
    expect(rowProblems({ graduationYear: "2024-25", graduates: 100, placed: 120, medianSalary: 400000, higherStudies: 0 })).toContain("placed > graduates");
    expect(rowProblems({ graduationYear: "2024-25", graduates: 100, placed: 50, medianSalary: null, higherStudies: 0 })).toContain("no median salary");
    expect(rowProblems(expected[0])).toEqual([]);
  });
});
