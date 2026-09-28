import { describe, expect, it } from "vitest";
import { mergeAndCheck, parseCsv, rowsFromFraFile, rowsFromManualCsv, type FeeProblem } from "../src/fees/feeRows.ts";

const fraFile = {
  _meta: { year: "2026-27" },
  "06007": {
    name: "Test College", collegeCode: "06007", tuitionFee: 66087, developmentFee: 9913, otherFees: 0, totalAnnualFee: 76000,
    tfwsAvailable: false, tfwsSeats: null, fraOrderRef: null, fraOrderUrl: null, sampleOnly: false, academicYear: "2026-27",
    fraInstituteId: "EN06007", fraName: "TEST", fraStatus: "Approved", fraMeetingDate: "2026-07-13", matchedBy: "code",
    sourceUrl: "https://ay26-27.mahafraportal.org/x?institute=EN06007",
  },
};

describe("fee rows", () => {
  it("parses quoted CSV fields with commas and quotes", () => {
    expect(parseCsv('code,college,total_fee\n01002,"Govt College, ""Amravati""",1000\n')).toEqual([
      { code: "01002", college: 'Govt College, "Amravati"', total_fee: "1000" },
    ]);
  });

  it("maps FRA entries and treats TFWS as not stated", () => {
    const [r] = rowsFromFraFile(fraFile);
    expect(r).toMatchObject({ collegeCode: "06007", academicYear: "2026-27", totalFee: 76000, source: "FRA", tfwsAvailable: null });
  });

  it("reads the manual sheet: skips rows without a total, needs a source URL, allows a total alone", () => {
    const problems: FeeProblem[] = [];
    const rows = rowsFromManualCsv(
      [
        "code,college,district,type,intake,tuition_fee,development_fee,other_fees,total_fee,academic_year,source_url,notes",
        "01002,A,Amravati,Government,300,,,,,2026-27,,",
        '16006,"COEP, Pune",Pune,Government,1185,"₹1,25,840",10000,14160,"1,50,000",2026-27,https://example.org/coep.pdf,CAP seats',
        "04025,C,Nagpur,Government,500,,,,21000,2026-27,https://example.org/gcoen.pdf,",
        "04004,D,Chandrapur,Government,300,,,,22000,2026-27,,",
      ].join("\n"),
      problems,
    );
    expect(rows.map((r) => [r.collegeCode, r.totalFee, r.tuitionFee, r.source])).toEqual([
      ["16006", 150000, 125840, "college"],
      ["04025", 21000, null, "college"],
    ]);
    expect(problems).toEqual([{ collegeCode: "04004", problem: "total given without a source_url" }]);
  });

  it("keeps FRA over a manual row for the same college and year, and rejects bad rows", () => {
    const problems: FeeProblem[] = [];
    const fra = rowsFromFraFile(fraFile);
    const manual = [
      { ...fra[0], source: "college" as const, totalFee: 1 },
      { ...fra[0], collegeCode: "99999" },
      { ...fra[0], collegeCode: "01002", tuitionFee: 10, developmentFee: 10, otherFees: 10, totalFee: 31 },
    ];
    const rows = mergeAndCheck(fra, manual, new Set(["06007", "01002"]), problems);
    expect(rows.map((r) => [r.collegeCode, r.source, r.totalFee])).toEqual([["06007", "FRA", 76000]]);
    expect(problems.map((p) => p.collegeCode)).toEqual(["06007", "99999", "01002"]);
  });
});
