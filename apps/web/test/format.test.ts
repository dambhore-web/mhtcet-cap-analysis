import { describe, expect, it } from "vitest";
import { avatarTint, collegeInitials, formatRound, formatRoundRange, roundIndex, roundNumeral } from "../src/lib/format";

describe("rounds", () => {
  it("formats numbers and numerals the same way", () => {
    expect(formatRound(2)).toBe("Round II");
    expect(formatRound("II")).toBe("Round II");
    expect(formatRound("3")).toBe("Round III");
    expect(formatRound(1, "short")).toBe("R I");
    expect(roundNumeral(4)).toBe("IV");
  });

  it("formats ranges", () => {
    expect(formatRoundRange(1, 3)).toBe("Rounds I–III");
    expect(formatRoundRange(2, 2)).toBe("Round II");
  });

  it("indexes Roman-numeral rounds for sorting", () => {
    expect(roundIndex("I")).toBe(1);
    expect(roundIndex("IV")).toBe(4);
    expect(roundIndex(3)).toBe(3);
    expect(["III", "I", "IV", "II"].sort((a, b) => roundIndex(a) - roundIndex(b))).toEqual(["I", "II", "III", "IV"]);
  });
});

describe("college avatar", () => {
  it("gives the same tint for the same code", () => {
    expect(avatarTint("6006")).toBe(avatarTint("6006"));
  });

  it("builds initials from capitalised words, falling back to the code", () => {
    expect(collegeInitials("College of Engineering Pune", "6006")).toBe("CE");
    expect(collegeInitials("abc", "6006")).toBe("06");
  });
});
