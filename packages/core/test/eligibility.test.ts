import { describe, expect, it } from "vitest";
import { eligibleSeatTypes, type CandidateProfile, type CollegeEligibilityContext } from "../src/index.ts";

const base: CandidateProfile = {
  candidature: "MH", homeUniversity: "Savitribai Phule Pune University",
  category: null, gender: "M",
  ews: false, tfws: false, defence: false, pwd: false, orphan: false,
  minorityCommunity: null, meritNumber: 5000, subjectGroup: "PCM",
};

const autoCollege: CollegeEligibilityContext = { homeUniversity: null, minorityCommunity: null };
const sameHUCollege: CollegeEligibilityContext = { homeUniversity: "Savitribai Phule Pune University", minorityCommunity: null };
const otherHUCollege: CollegeEligibilityContext = { homeUniversity: "Mumbai University", minorityCommunity: null };

describe("eligibleSeatTypes", () => {
  it("AI candidate → only AI", () => {
    expect(eligibleSeatTypes({ ...base, candidature: "AI" }, sameHUCollege)).toEqual(["AI"]);
  });

  it("open male at autonomous college → GOPENS + LOPENS only (State Level only)", () => {
    const codes = eligibleSeatTypes(base, autoCollege);
    expect(codes).toContain("GOPENS");
    expect(codes).toContain("LOPENS");
    expect(codes).not.toContain("GOPENH");
    expect(codes).not.toContain("GOPENO");
  });

  it("open male at same-HU college → GOPENS + GOPENH (no O)", () => {
    const codes = eligibleSeatTypes(base, sameHUCollege);
    expect(codes).toContain("GOPENS");
    expect(codes).toContain("GOPENH");
    expect(codes).not.toContain("GOPENO");
  });

  it("open male at different-HU college → GOPENS + GOPENO (no H)", () => {
    const codes = eligibleSeatTypes(base, otherHUCollege);
    expect(codes).toContain("GOPENS");
    expect(codes).toContain("GOPENO");
    expect(codes).not.toContain("GOPENH");
  });

  it("includes ladies seats for male candidates (Stage II eligibility)", () => {
    const codes = eligibleSeatTypes(base, sameHUCollege);
    expect(codes).toContain("LOPENS");
    expect(codes).toContain("LOPENH");
  });

  it("female OBC at same-HU college → G+L codes for OPEN and OBC, H and S levels", () => {
    const codes = eligibleSeatTypes({ ...base, gender: "F", category: "OBC" }, sameHUCollege);
    expect(codes).toContain("GOPENS");
    expect(codes).toContain("GOPENH");
    expect(codes).toContain("GOBCS");
    expect(codes).toContain("GOBCH");
    expect(codes).toContain("LOPENS");
    expect(codes).toContain("LOPENH");
    expect(codes).toContain("LOBCS");
    expect(codes).toContain("LOBCH");
    expect(codes).not.toContain("GOPENO");
  });

  it("EWS candidate → includes EWS standalone code", () => {
    const codes = eligibleSeatTypes({ ...base, ews: true }, sameHUCollege);
    expect(codes).toContain("EWS");
  });

  it("TFWS candidate → includes TFWS", () => {
    const codes = eligibleSeatTypes({ ...base, tfws: true }, autoCollege);
    expect(codes).toContain("TFWS");
  });

  it("orphan candidate → ORPHANI and ORPHANN", () => {
    const codes = eligibleSeatTypes({ ...base, orphan: true }, autoCollege);
    expect(codes).toContain("ORPHANI");
    expect(codes).toContain("ORPHANN");
  });

  it("PWD OBC at same-HU college → PWD + PWDR codes for OPEN and OBC", () => {
    const codes = eligibleSeatTypes({ ...base, pwd: true, category: "OBC" }, sameHUCollege);
    expect(codes).toContain("PWDOPENS");
    expect(codes).toContain("PWDOPENH");
    expect(codes).toContain("PWDROBCS");
    expect(codes).toContain("PWDROBCH");
  });

  it("defence SC at other-HU college → DEF + DEFR codes with O and S levels", () => {
    const codes = eligibleSeatTypes({ ...base, defence: true, category: "SC" }, otherHUCollege);
    expect(codes).toContain("DEFOPENS");
    expect(codes).toContain("DEFOPENO");
    expect(codes).toContain("DEFSCS");
    expect(codes).toContain("DEFRSCO");
  });

  it("minority match → MI included; mismatch or null → MI excluded", () => {
    const muslim = { homeUniversity: "Mumbai University", minorityCommunity: "Muslim" };
    expect(eligibleSeatTypes({ ...base, minorityCommunity: "Muslim" }, muslim)).toContain("MI");
    expect(eligibleSeatTypes({ ...base, minorityCommunity: "Christian" }, muslim)).not.toContain("MI");
    expect(eligibleSeatTypes({ ...base, minorityCommunity: null }, muslim)).not.toContain("MI");
    expect(eligibleSeatTypes({ ...base, minorityCommunity: "Muslim" }, sameHUCollege)).not.toContain("MI");
  });

  it("EWS applies only to Open-category candidates", () => {
    expect(eligibleSeatTypes({ ...base, ews: true, category: null }, sameHUCollege)).toContain("EWS");
    expect(eligibleSeatTypes({ ...base, ews: true, category: "OBC" }, sameHUCollege)).not.toContain("EWS");
  });

  it("returns no duplicate codes", () => {
    const codes = eligibleSeatTypes({ ...base, pwd: true, category: "OBC", ews: true }, sameHUCollege);
    expect(codes.length).toBe(new Set(codes).size);
  });
});
