import { describe, expect, it } from "vitest";
import { collegeRows, districtIntro, districtMeta, formatLakh, groupIntro, groupRows, noFeeText, type DistrictDetail } from "../src/lib/districts";
import { collegeMeta } from "../src/lib/seo";

const D: DistrictDetail = {
  year: 2026,
  slug: "mumbai-suburban",
  name: "Mumbai-Suburban",
  groups: [],
  colleges: [
    {
      code: "3215", name: "Late College", collegeType: "Un-Aided", fee: { total: 120000, year: "2026-27" }, placement: null,
      branches: [{ choiceCode: "321524210", name: "Computer Engineering", group: "Computer & IT", roundI: 40000, latest: 52000, seatType: "GOPENS" }],
    },
    {
      code: "3012", name: "Early College", collegeType: "Government", fee: null, placement: null,
      branches: [
        { choiceCode: "301261210", name: "Mechanical Engineering", group: "Mechanical", roundI: 9000, latest: 9500, seatType: "GOPENS" },
        { choiceCode: "301224210", name: "Computer Engineering", group: "Computer & IT", roundI: null, latest: 3000, seatType: "GOPENS" },
      ],
    },
  ],
};

describe("district landing page text (SEO)", () => {
  it("sorts colleges by their lowest closing merit number, Round I or else the last round", () => {
    const rows = collegeRows(D.colleges);
    expect(rows.map((r) => r.college.code)).toEqual(["3012", "3215"]);
    expect(rows[0].top.choiceCode).toBe("301224210");
    expect(groupRows(D.colleges, "Computer & IT").map((r) => r.branch.choiceCode)).toEqual(["301224210", "321524210"]);
  });

  it("writes a factual intro with past numbers only", () => {
    const intro = districtIntro(D);
    expect(intro).toBe(
      "Mumbai Suburban district has 2 engineering colleges with 3 branches in MHT-CET CAP 2026. " +
        "The lowest closing merit number on open seats was 3,000, for Computer Engineering at Early College (last round). " +
        "The FRA has published approved fees for 1 of the 2 colleges.",
    );
    expect(groupIntro(D, "Computer & IT")).toContain("ranged from 3,000 (Computer Engineering, Early College) to 40,000.");
    const text = `${intro} ${districtMeta(D).title} ${districtMeta(D).description}`;
    expect(text).not.toMatch(/you can get|safest|guarantee|best/i);
  });

  it("explains a missing fee rather than guessing one", () => {
    expect(noFeeText("Government")).toBe("Set by the state");
    expect(noFeeText("Government-Aided Autonomous")).toBe("Set by the state");
    expect(noFeeText("Un-Aided")).toBe("Not published");
    expect(noFeeText(null)).toBe("Not published");
  });

  it("formats salaries in lakh", () => {
    expect(formatLakh(1200000)).toBe("₹12 lakh");
    expect(formatLakh(450000)).toBe("₹4.5 lakh");
  });

  it("college titles keep the district when the name only shares letters with it", () => {
    // "Nashik" once split on the letter "s" to "Na", which appears in many names
    expect(collegeMeta({ name: "Sandip Foundation, National Institute", district: "Nashik" }, 3, 2026).description).toContain(", Nashik:");
  });
});
