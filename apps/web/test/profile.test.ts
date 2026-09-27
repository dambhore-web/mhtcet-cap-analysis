import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, parseProfile } from "../src/lib/profile";

describe("parseProfile", () => {
  it("rejects non-objects", () => {
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile("x")).toBeNull();
    expect(parseProfile([1, 2])).toBeNull();
  });

  it("keeps valid fields and defaults the rest", () => {
    const p = parseProfile({ meritNumber: 12840, category: "NT2", gender: "F", subjectGroup: "PCB", ews: true, tfws: "yes" });
    expect(p).toEqual({ ...DEFAULT_PROFILE, meritNumber: 12840, category: "NT2", gender: "F", subjectGroup: "PCB", ews: true });
  });

  it("drops invalid merit numbers and categories", () => {
    const p = parseProfile({ meritNumber: -5, category: "NT-A" });
    expect(p?.meritNumber).toBeNull();
    expect(p?.category).toBeNull();
  });
});
