import { describe, expect, it } from "vitest";
import { buildFeeEntries, fraIdToCollegeCode, instituteUrl, normaliseName, possibleRows, type CurrentCollege, type FeeReportInput } from "../src/fees/buildFees.ts";
import { parseFraReport, type FraFeeRow } from "../src/fees/fraReport.ts";

// Synthetic report in the portal's layout (fake institutes).
const HEADER = ["Sr. No.", "Inst ID", "Inst Name", "District", "Stream", "Status", "Date of Meeting", "Tuition Fee", "Development Fee", "Total Fee"];
const tr = (cells: string[]) => `<tr>${cells.map((c) => `<td>\n\t\t${c}\t\t</td>`).join("")}<!-- <td>review</td> --></tr>`;
const html = (year: string, rows: string[][]) =>
  `<br><center><font><b>Fee Approved by Fees Regulating Authority, Maharashtra for Academic Year ${year}</b></font></center>
   <table class="DataGrid"><tr bgcolor="#33ccff">${HEADER.map((h) => `<td><b>${h}</b></td>`).join("")}
   <!-- <td><b>Review Status</b></td> --></tr>${rows.map(tr).join("\n")}</table>`;

describe("parseFraReport", () => {
  it("reads the year and every column, ignoring commented-out review cells", () => {
    const r = parseFraReport(
      html("2026-27", [
        ["1", "EN09001", "TEST COLLEGE OF ENGINEERING &amp; RESEARCH", "Pune", "ENGG", "Approved", "15-06-2026", "82805", "8695", "91500"],
        ["2", "MC9002", "TEST�S INSTITUTE", "Nashik", "ENGG", "No Upward Revision", "19-06-2025", "1,15,586", "16414", "132000"],
      ]),
    );
    expect(r.academicYear).toBe("2026-27");
    expect(r.issues).toEqual([]);
    expect(r.rows[0]).toEqual({
      instId: "EN09001", name: "TEST COLLEGE OF ENGINEERING & RESEARCH", district: "Pune", stream: "ENGG", status: "Approved",
      meetingDate: "2026-06-15", tuitionFee: 82805, developmentFee: 8695, totalFee: 91500,
    });
    expect(r.rows[1]).toMatchObject({ name: "TEST'S INSTITUTE", meetingDate: "2025-06-19", tuitionFee: 115586 });
  });

  it("reports rows it cannot read instead of guessing", () => {
    const r = parseFraReport(html("2026-27", [["1", "EN09001", "X", "Pune", "ENGG", "Approved", "15-06-2026", "", "0", "100"], ["2", "short"]]));
    expect(r.rows).toEqual([]);
    expect(r.issues).toEqual(["row 1 (EN09001): non-numeric fee", "row 2: 2 cells"]);
  });

  it("flags a changed header", () => {
    expect(parseFraReport("<table><tr><td>Inst ID</td></tr></table>").issues[0]).toMatch(/unexpected header/);
  });
});

describe("fraIdToCollegeCode", () => {
  it("pads and normalises the digits of the FRA id", () => {
    expect(fraIdToCollegeCode("EN6007")).toBe("06007");
    expect(fraIdToCollegeCode("EN06007")).toBe("06007");
    expect(fraIdToCollegeCode("EN16121")).toBe("16121");
    expect(fraIdToCollegeCode("EN6006")).toBe("16006"); // COEP's pre-university code
    expect(fraIdToCollegeCode("MC5151")).toBe("05151");
    expect(fraIdToCollegeCode("bad")).toBeNull();
  });
});

describe("buildFeeEntries", () => {
  const colleges: CurrentCollege[] = [
    { code: "09001", name: "Test College of Engineering & Research, Pune", collegeType: "Unaided" },
    { code: "16006", name: "Test Technological University", collegeType: "Government" },
    { code: "09003", name: "Renamed Institute of Technology", collegeType: "Unaided" },
    { code: "09004", name: "Only Last Year College", collegeType: "Unaided" },
    { code: "09005", name: "Split Missing College", collegeType: "Unaided" },
    { code: "09006", name: "Brand New College", collegeType: "Unaided" },
  ];
  const row = (instId: string, name: string, t: number, d: number, total: number, extra: Partial<FraFeeRow> = {}): FraFeeRow => ({
    instId, name, district: "Pune", stream: "ENGG", status: "Approved", meetingDate: "2026-06-15", tuitionFee: t, developmentFee: d, totalFee: total, ...extra,
  });
  const url = (host: string) => `https://${host}/admin/reports/ajax/get_report_ajax.php?district=all&institute=&sub_type=ENGG&type=HT`;
  const reports: FeeReportInput[] = [
    {
      academicYear: "2026-27",
      reportUrl: url("ay26-27.example"),
      rows: [
        row("EN9001", "TEST COLLEGE OF ENGINEERING AND RESEARCH", 80000, 10000, 91500),
        row("EN6006", "TEST TECHNOLOGICAL UNIVERSITY", 100000, 10000, 110000), // old code → 16006
        row("EN9703", "RENAMED INSTITUTE OF TECHNOLOGY", 70000, 7000, 77000), // other code, exact name
        row("EN9005", "SPLIT MISSING COLLEGE", 0, 0, 136000, { status: "No Upward Revision", meetingDate: "2025-07-17" }),
        row("EN9999", "NOT A CAP COLLEGE", 1, 1, 2),
        row("EN9001", "DUPLICATE ROW", 1, 1, 2, { instId: "AR9001" }),
        row("EN9006", "BRAND NEW COLLEGE", 1, 1, 2, { stream: "ENGGWP" }),
      ],
    },
    {
      academicYear: "2025-26",
      reportUrl: url("ay25-26.example"),
      rows: [
        row("EN9001", "TEST COLLEGE OF ENGINEERING AND RESEARCH", 1, 1, 2), // newer year already used
        row("EN9004", "ONLY LAST YEAR COLLEGE", 60000, 6000, 66000, { meetingDate: "2025-05-09" }),
        row("EN9005", "SPLIT MISSING COLLEGE", 119297, 16703, 136000, { meetingDate: "2025-07-17" }),
      ],
    },
  ];
  const out = buildFeeEntries(reports, colleges);

  it("matches by normalised code, keeps the CAP name and records the source", () => {
    expect(out.entries.get("09001")).toMatchObject({
      name: "Test College of Engineering & Research, Pune", collegeCode: "09001", tuitionFee: 80000, developmentFee: 10000, otherFees: 1500,
      totalAnnualFee: 91500, academicYear: "2026-27", fraInstituteId: "EN9001", fraStatus: "Approved", fraMeetingDate: "2026-06-15", matchedBy: "code",
      tfwsAvailable: false, tfwsSeats: null, fraOrderRef: null, fraOrderUrl: null, sampleOnly: false,
      sourceUrl: "https://ay26-27.example/admin/reports/ajax/get_report_ajax.php?district=all&institute=EN9001&sub_type=ENGG&type=HT",
    });
    expect(out.entries.get("16006")).toMatchObject({ fraInstituteId: "EN6006", matchedBy: "code" });
  });

  it("falls back to an exact normalised name only", () => {
    expect(out.entries.get("09003")).toMatchObject({ fraInstituteId: "EN9703", matchedBy: "name" });
    expect(out.unusedRows).toContainEqual(expect.objectContaining({ instId: "EN9999", reason: expect.stringMatching(/not a current CAP college/) }));
  });

  it("uses an older report only for colleges the newer one lacks", () => {
    expect(out.entries.get("09004")).toMatchObject({ academicYear: "2025-26", totalAnnualFee: 66000 });
    expect(out.entries.get("09001")?.academicYear).toBe("2026-27");
  });

  it("takes a missing split only from the same unrevised approval, with a note", () => {
    const e = out.entries.get("09005")!;
    expect(e).toMatchObject({ academicYear: "2026-27", tuitionFee: 119297, developmentFee: 16703, otherFees: 0, totalAnnualFee: 136000 });
    expect(e.note).toMatch(/only the total/);
    const alone = buildFeeEntries([reports[0]], colleges);
    expect(alone.entries.has("09005")).toBe(false);
    expect(alone.unmatchedColleges.find((c) => c.code === "09005")?.reason).toMatch(/without a tuition\/development split/);
  });

  it("keeps the first row for a college and reports duplicates and other streams", () => {
    expect(out.unusedRows).toContainEqual(expect.objectContaining({ instId: "AR9001", reason: "09001 already matched to EN9001" }));
    expect(out.unusedRows).toContainEqual(expect.objectContaining({ instId: "EN9006", reason: "stream ENGGWP" }));
  });

  it("lists every current college left without fees, with a reason", () => {
    expect(out.unmatchedColleges).toEqual([
      { code: "09006", name: "Brand New College", collegeType: "Unaided", reason: "not on the FRA 2026-27 and 2025-26 engineering reports by code or exact name" },
    ]);
    const gov = buildFeeEntries([], [colleges[1]]).unmatchedColleges[0];
    expect(gov.reason).toMatch(/Government college \(FRA approves fees of unaided private institutes only\)/);
  });
});

describe("helpers", () => {
  it("normalises names like the API's fee index", () => {
    expect(normaliseName("Dr. D. Y. Patil College of Engg. & Tech.,Pune")).toBe("dr d y patil college of engg and tech pune");
  });
  it("narrows the report URL to one institute", () => {
    expect(instituteUrl("https://h/x.php?district=all&institute=&sub_type=ENGG&type=HT", "EN6007")).toBe("https://h/x.php?district=all&institute=EN6007&sub_type=ENGG&type=HT");
  });
  it("suggests unused rows sharing distinctive words, for a human to check", () => {
    const rows = [
      { academicYear: "2026-27", instId: "EN5180", name: "NASHIK GRAMIN SHIKSHAN PRASARAK MANDAL'S BRAHMA VALLEY COLLEGE OF ENGINEERING", reason: "" },
      { academicYear: "2026-27", instId: "EN1", name: "SHIKSHAN PRASARAK MANDAL COLLEGE OF ENGINEERING", reason: "" },
    ];
    expect(possibleRows({ code: "05130", name: "Brahma Valley College of Engineering, Nashik", collegeType: "Unaided" }, rows).map((r) => r.instId)).toEqual(["EN5180"]);
  });
});
