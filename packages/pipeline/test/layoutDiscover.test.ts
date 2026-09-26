import { describe, expect, it } from "vitest";
import { findAllotmentPdfs, findCutoffLists, findMeritLists } from "../src/discover.ts";
import { clusterLines, median } from "../src/layout.ts";
import { parseInstituteList } from "../src/parse/instituteList.ts";
import { line, w } from "./words.ts";

describe("clusterLines", () => {
  it("joins words within 3 pt and keeps separate rows apart", () => {
    const lines = clusterLines([w(47, 502, "I"), w(73, 504, "123"), w(73, 512, "(99.0)"), ...line(530, [10, "B"], [5, "A"])]);
    expect(lines.map((l) => l.text)).toEqual(["I 123", "(99.0)", "A B"]);
    expect(median([3, 1, 2, 10])).toBe(2.5);
  });
});

describe("discover", () => {
  const links = [
    "https://cappublicdocs2026.blob.core.windows.net/documents/2026ENGG_CAP1_MH_CutOff_V1.pdf",
    "https://cappublicdocs2026.blob.core.windows.net/documents/2026ENGG_CAP4_Diploma_CutOff.pdf",
    "https://fe2026.mahacet.org/2025/2025ENGG_CAP1_AI_CutOff.pdf",
    "https://cappublicdocs2026.blob.core.windows.net/meritlists/final/FE2026_PCMAI_MeritList_Final.pdf",
  ];
  it("finds this year's cutoff and merit lists only", () => {
    expect(findCutoffLists(links, 2026).map((c) => [c.kind, c.round, c.version, c.file])).toEqual([
      ["MH", "I", 1, "cutoff/2026ENGG_CAP1_MH_CutOff_V1.pdf"],
      ["Diploma", "IV", null, "cutoff/2026ENGG_CAP4_Diploma_CutOff.pdf"],
    ]);
    expect(findMeritLists(links, 2026)).toEqual([{ url: links[3], list: "PCMAI", stage: "Final", file: "merit/PCMAI_final.pdf" }]);
  });
  it("reads allotment links per institute row", () => {
    const html =
      '<tr><td class="Item">1.</td><td class="Item">99001</td><td class="Item">Test &amp; College </td>' +
      '<td class="Item"><a href ="https://fe2026.mahacet.org/CAP-I/CAPR-I_99001.pdf"target="_blank"></a></td>' +
      '<td class="Item"><a href ="https://fe2026.mahacet.org/CAP-II/CAPR-II_99001.pdf"target="_blank"></a></td></tr>';
    expect(findAllotmentPdfs(html, 2026)).toEqual([
      { collegeCode: "99001", collegeName: "Test & College", round: "I", url: "https://fe2026.mahacet.org/CAP-I/CAPR-I_99001.pdf", file: "allotment/CAPR-I_99001.pdf" },
      { collegeCode: "99001", collegeName: "Test & College", round: "II", url: "https://fe2026.mahacet.org/CAP-II/CAPR-II_99001.pdf", file: "allotment/CAPR-II_99001.pdf" },
    ]);
  });
  it("parses the institute list", () => {
    const html =
      '<td class="Header">1.</td><td class="Item"><a href="frmInstituteSummary.aspx?InstituteCode=99001">99001</a></td>' +
      '<td class="Item">Test&#39;s College </td><td class="Item">Un-Aided, Autonomous</td><td class="Item">360</td>';
    expect(parseInstituteList(html)).toEqual([{ code: "99001", name: "Test's College", status: "Un-Aided, Autonomous", totalIntake: 360 }]);
  });
});
