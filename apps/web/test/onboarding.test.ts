import { describe, expect, it } from "vitest";
import {
  EMPTY_ANSWERS,
  parseBranchGroups,
  parseMerit,
  parsePercentile,
  searchMerit,
  toFindParams,
  toProfile,
  visibleSteps,
  type Answers,
} from "../src/lib/onboarding";

const a = (over: Partial<Answers>): Answers => ({ ...EMPTY_ANSWERS, ...over });

describe("visibleSteps", () => {
  it("shows every question for MHT-CET", () => {
    expect(visibleSteps(a({}))).toEqual(["exam", "have", "score", "category", "gender", "university", "special", "minority", "branches"]);
  });
  it("skips the state-quota questions for JEE (All India seats)", () => {
    expect(visibleSteps(a({ exam: "AI" }))).toEqual(["exam", "have", "score", "branches"]);
  });
});

describe("parsing", () => {
  it("reads merit numbers with commas and rejects anything else", () => {
    expect(parseMerit("12,450")).toBe(12450);
    expect(parseMerit(" 5200 ")).toBe(5200);
    expect(parseMerit("0")).toBeNull();
    expect(parseMerit("12a")).toBeNull();
    expect(parseMerit("")).toBeNull();
  });
  it("reads percentiles between 0 and 100", () => {
    expect(parsePercentile("96.82")).toBe(96.82);
    expect(parsePercentile("0")).toBeNull();
    expect(parsePercentile("101")).toBeNull();
  });
  it("searches with the middle of an estimated range", () => {
    expect(searchMerit(a({ have: "percentile", estimate: [11900, 13100] }))).toBe(12500);
    expect(searchMerit(a({ have: "percentile", estimate: null }))).toBeNull();
  });
});

describe("toFindParams", () => {
  it("builds the Find URL for a state merit number with seat details", () => {
    const p = toFindParams(
      a({ merit: "12,450", category: "OBC", gender: "F", homeUniversity: "Savitribai Phule Pune University",
        flags: { ews: false, tfws: true, defence: false, pwd: false, orphan: false }, minority: "Jain",
        branchGroups: ["Computer & IT", "Electronics & Telecom"] }),
    )!;
    expect(Object.fromEntries(p)).toEqual({
      merit: "12450", cat: "OBC", gen: "F", hu: "Savitribai Phule Pune University", tfws: "1", min: "Jain",
      bg: "Computer & IT,Electronics & Telecom", scan: "1",
    });
  });
  it("marks a percentile search as estimated", () => {
    const p = toFindParams(a({ have: "percentile", estimate: [11900, 13100], subjectGroup: "PCB" }))!;
    expect(p.get("merit")).toBe("12500");
    expect(p.get("est")).toBe("1");
    expect(p.get("subj")).toBe("PCB");
  });
  it("sends JEE students to All India seats without state-quota details", () => {
    const p = toFindParams(a({ exam: "AI", merit: "8000", category: "SC", homeUniversity: "University of Mumbai", minority: "Muslim" }))!;
    expect(Object.fromEntries(p)).toEqual({ merit: "8000", list: "AI", scan: "1" });
  });
  it("drops EWS for a reserved category", () => {
    const flags = { ews: true, tfws: false, defence: false, pwd: false, orphan: false };
    expect(toFindParams(a({ merit: "100", category: "OBC", flags }))!.get("ews")).toBeNull();
    expect(toFindParams(a({ merit: "100", category: "", flags }))!.get("ews")).toBe("1");
  });
  it("returns null without a merit number", () => {
    expect(toFindParams(a({ merit: "" }))).toBeNull();
  });
});

describe("toProfile", () => {
  it("saves a typed state merit number and the seat details", () => {
    const p = toProfile(a({ merit: "12450", category: "OBC", gender: "F", minority: "Muslim",
      flags: { ews: true, tfws: true, defence: false, pwd: false, orphan: false } }));
    expect(p).toMatchObject({ meritNumber: 12450, category: "OBC", gender: "F", minorityCommunity: "Muslim", ews: false, tfws: true });
  });
  it("doesn't save an estimate or an All India merit number as the state merit number", () => {
    expect(toProfile(a({ have: "percentile", estimate: [100, 200] })).meritNumber).toBeNull();
    expect(toProfile(a({ exam: "AI", merit: "900" })).meritNumber).toBeNull();
  });
});

describe("parseBranchGroups", () => {
  it("keeps known groups only, without duplicates", () => {
    expect(parseBranchGroups("Civil,Nope,Civil,Mechanical", ["Civil", "Mechanical"])).toEqual(["Civil", "Mechanical"]);
    expect(parseBranchGroups(null, ["Civil"])).toEqual([]);
  });
});
