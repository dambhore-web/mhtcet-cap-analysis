import { describe, expect, it } from "vitest";
import type { ListItem } from "../src/lib/list";
import { listChecks, reachOf, freezeRoundOf } from "../src/lib/optionForm";
import { analyseAllotment } from "../src/lib/allotment";
import { buildSummary, decodeSummary, encodeSummary } from "../src/lib/summary";
import { toCSV, choiceCodesText } from "../src/lib/exportForm";

const item = (n: number, first: number | null, last: number, college = `C${n}`): ListItem => ({
  id: `i${n}`,
  choiceCode: `${n}`.padStart(10, "0"),
  collegeCode: college,
  collegeName: `College ${college}`,
  branch: `Branch ${n}`,
  seatType: "GOPENS",
  closingMerit: last,
  year: 2026,
  firstRoundClosing: first,
  lastRoundClosing: last,
});

describe("option form (#90)", () => {
  it("classifies reach from Round I and last-round closing", () => {
    expect(reachOf(item(1, 1000, 1500), 900)).toBe("round-I");
    expect(reachOf(item(1, 1000, 1500), 1200)).toBe("later");
    expect(reachOf(item(1, 1000, 1500), 2000)).toBe("out");
    expect(reachOf(item(1, 1000, 1500), null)).toBe("unknown");
  });

  it("marks freeze zones by preference", () => {
    expect([1, 2, 3, 4, 6, 7].map(freezeRoundOf)).toEqual(["I", "II", "II", "III", "III", null]);
  });

  it("warns when nothing was within reach", () => {
    const c = listChecks([item(1, 100, 200), item(2, 300, 400)], 5000);
    expect(c[0]).toMatchObject({ level: "warn" });
    expect(c[0].text).toMatch(/None of your choices/);
  });

  it("notes choices below a Round I safe choice", () => {
    const c = listChecks([item(1, 100, 200), item(2, 6000, 7000), item(3, 8000, 9000)], 5000);
    expect(c.some((x) => /Choice 2 admitted your merit number in Round I/.test(x.text))).toBe(true);
  });
});

describe("after allotment (#84)", () => {
  const items = [item(1, 100, 6000, "A"), item(2, 200, 300, "B"), item(3, 3000, 4000, "C"), item(4, 5000, 9000, "C")];

  it("says the seat is frozen inside the auto-freeze zone", () => {
    expect(analyseAllotment(items, { round: "II", choiceCode: items[2].choiceCode }, 5000)?.advice).toBe("frozen");
  });

  it("suggests float when a higher choice at another college opened last year", () => {
    const a = analyseAllotment(items, { round: "I", choiceCode: items[3].choiceCode }, 5000)!;
    expect(a.advice).toBe("float");
    expect(a.higher.map((h) => h.openedLastYear)).toEqual([true, false, false]);
  });

  it("suggests freeze when no higher choice opened", () => {
    const list = [item(1, 100, 200), item(2, 5000, 9000)];
    expect(analyseAllotment(list, { round: "I", choiceCode: list[1].choiceCode }, 5000)?.advice).toBe("freeze");
  });

  it("suggests slide when the only higher choices that opened are at the same college", () => {
    const list = [item(1, 100, 200, "X"), item(2, 4000, 6000, "Y"), item(3, 5000, 9000, "Y")];
    expect(analyseAllotment(list, { round: "I", choiceCode: list[2].choiceCode }, 5000)?.advice).toBe("slide");
  });

  it("treats Round IV as final", () => {
    expect(analyseAllotment(items, { round: "IV", choiceCode: items[3].choiceCode }, 5000)?.advice).toBe("final");
  });
});

describe("family summary link (#116)", () => {
  it("round-trips through the link and carries no personal data", () => {
    const s = buildSummary({ merit: 5200, category: "OBC", gender: "F", items: [item(1, 100, 200)], allotment: null, today: new Date("2026-09-27") });
    const encoded = encodeSummary(s);
    expect(decodeSummary(encoded)).toEqual(s);
    expect(Object.keys(s).sort()).toEqual(["allotment", "category", "choices", "gender", "merit", "preparedOn", "v"]);
  });

  it("rejects a tampered link", () => {
    expect(decodeSummary("not-base64!!")).toBeNull();
    expect(decodeSummary(encodeSummary({ v: 2 } as never))).toBeNull();
  });
});

describe("exports (#83)", () => {
  it("writes the option form in order, with the merit compared in words", () => {
    const csv = toCSV([item(1, 100, 6000), item(2, 200, 4000)], 5000).split("\r\n");
    expect(csv[0]).toContain('"Choice code"');
    expect(csv[1]).toContain('"1","0000000001"');
    expect(csv[1]).toContain('"1,000 better"');
    expect(csv[2]).toContain('"1,000 worse"');
    expect(choiceCodesText([item(1, 1, 2), item(2, 1, 2)])).toBe("0000000001\n0000000002");
  });
});
