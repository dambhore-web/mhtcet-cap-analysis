import { describe, expect, it } from "vitest";
import { branchGroupOf } from "../src/branchGroups.ts";

describe("branchGroupOf (#137)", () => {
  it("groups official branch names", () => {
    expect(branchGroupOf("Computer Engineering")).toBe("Computer & IT");
    expect(branchGroupOf("Artificial Intelligence (AI) and Data Science")).toBe("Computer & IT");
    expect(branchGroupOf("Information Technology")).toBe("Computer & IT");
    expect(branchGroupOf("Electronics and Telecommunication Engg")).toBe("Electronics & Telecom");
    expect(branchGroupOf("Mechanical Engineering")).toBe("Mechanical");
    expect(branchGroupOf("Civil Engineering")).toBe("Civil");
  });

  it("puts the first match first: Electronics and Computer Engineering is Computer & IT", () => {
    expect(branchGroupOf("Electronics and Computer Engineering")).toBe("Computer & IT");
  });

  it("falls back to Other", () => {
    expect(branchGroupOf("Textile Technology")).toBe("Other");
  });
});
