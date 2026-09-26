import { describe, expect, it } from "vitest";
import { authorityRules, isSeatType, parseSeatType } from "../src/index.ts";

describe("seat-type grammar", () => {
  it("parses quota + category + level codes", () => {
    expect(parseSeatType("GOPENS")).toEqual({ code: "GOPENS", kind: "reserved", quota: "G", category: "OPEN", level: "S", ladies: false });
    expect(parseSeatType("LOBCH")).toMatchObject({ quota: "L", category: "OBC", level: "H", ladies: true });
    expect(parseSeatType("GNT1O")).toMatchObject({ category: "NT1", level: "O" });
    expect(parseSeatType("PWDROBCS")).toMatchObject({ quota: "PWDR", category: "OBC" });
    expect(parseSeatType("DEFRSEBCS")).toMatchObject({ quota: "DEFR", category: "SEBC" });
    expect(parseSeatType("PWDRSTS")).toMatchObject({ quota: "PWDR", category: "ST" });
    expect(parseSeatType("DEFOPENS")).toMatchObject({ quota: "DEF", category: "OPEN" });
    expect(parseSeatType("PWDSCS")).toMatchObject({ quota: "PWD", category: "SC" });
  });

  it("parses standalone codes", () => {
    for (const c of ["TFWS", "EWS", "MI", "ORPHANI", "ORPHANN", "AI"]) expect(parseSeatType(c)).toMatchObject({ kind: "standalone", standalone: c });
  });

  it("rejects codes outside the grammar", () => {
    for (const c of ["ORPHAN2", "PWD", "Stage", "GOPEN", "XOPENS", "GOPENX", "", "gopens"]) expect(isSeatType(c)).toBe(false);
  });

  it("is reachable per authority", () => {
    expect(authorityRules("MH-CET-CELL").parseSeatType("GSCS")).not.toBeNull();
    expect(authorityRules("MH-CET-CELL").defaultExam).toBe("MHT-CET");
  });
});
