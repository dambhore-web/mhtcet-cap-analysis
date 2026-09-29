import { describe, expect, it } from "vitest";
import { activeFlags, answersSummary, branchesLabel, specialSeatsLabel, type TileAnswers } from "../src/lib/answerTiles";

const base: TileAnswers = {
  exam: "MH",
  category: "",
  gender: "M",
  homeUniversity: "",
  ews: false,
  tfws: false,
  defence: false,
  pwd: false,
  orphan: false,
  minority: "",
};
const a = (over: Partial<TileAnswers>): TileAnswers => ({ ...base, ...over });

describe("special seats", () => {
  it("says None when no special seat applies", () => {
    expect(specialSeatsLabel(base)).toBe("None");
  });
  it("lists the seats that apply, in the usual order", () => {
    expect(specialSeatsLabel(a({ defence: true, tfws: true }))).toBe("TFWS, Defence");
  });
  it("drops EWS for a reserved category", () => {
    expect(activeFlags(a({ ews: true, category: "OBC" }))).toEqual([]);
    expect(activeFlags(a({ ews: true }))).toEqual(["ews"]);
  });
});

describe("branches", () => {
  it("reads All branches when none are chosen", () => {
    expect(branchesLabel([])).toBe("All branches");
    expect(branchesLabel(["Computer & IT", "Civil"])).toBe("Computer & IT, Civil");
  });
});

describe("answersSummary", () => {
  it("puts the state-merit answers on one line", () => {
    expect(
      answersSummary(a({ category: "OBC", gender: "F", homeUniversity: "Savitribai Phule Pune University", tfws: true, minority: "Jain" }), 12450, ["Computer & IT"]),
    ).toBe("12,450 · OBC · Female · Savitribai Phule Pune University · TFWS · Jain · Computer & IT");
  });
  it("leaves out the state-quota answers for JEE Main", () => {
    expect(answersSummary(a({ exam: "AI", category: "OBC", tfws: true }), 3000, [])).toBe("All India 3,000 · JEE Main · Male");
  });
  it("says when there is no merit number yet", () => {
    expect(answersSummary(base, null, [])).toBe("No merit number yet · Open · Male");
  });
});
