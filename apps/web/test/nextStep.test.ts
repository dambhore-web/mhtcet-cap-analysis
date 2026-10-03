import { describe, expect, it } from "vitest";
import { nextStep, type StepState } from "../src/lib/nextStep";
import { EMPTY_PROGRESS, decidedOn } from "../src/lib/progress";

const base: StepState = { merit: 5200, listSize: 0, allotment: null, progress: EMPTY_PROGRESS };
const at = "2026-10-02T10:00:00.000Z";

describe("nextStep (#135): one primary action per CAP stage", () => {
  it("without a merit number, estimates from the percentile", () => {
    const s = nextStep({ ...base, merit: null });
    expect([s.id, s.to]).toEqual(["estimate", "/estimate"]);
  });

  it("with a merit number and an empty option form, adds choices from the results", () => {
    const s = nextStep(base);
    expect([s.id, s.title]).toEqual(["add-choices", "Add choices to your option form"]);
    expect(s.to).toBe("/find#results-title");
  });

  it("with choices but no simulation, tests the list", () => {
    const s = nextStep({ ...base, listSize: 12 });
    expect([s.id, s.to, s.stage]).toEqual(["simulate", "/simulator", "12 choices on your option form"]);
  });

  it("after simulating, exports for the CAP portal", () => {
    const s = nextStep({ ...base, listSize: 12, progress: { ...EMPTY_PROGRESS, simulatedAt: at } });
    expect([s.id, s.to]).toEqual(["export", "/export"]);
  });

  it("after exporting, waits for the allotment", () => {
    const s = nextStep({ ...base, listSize: 12, progress: { ...EMPTY_PROGRESS, simulatedAt: at, exportedAt: at } });
    expect([s.id, s.to]).toEqual(["allotment", "/allotment"]);
  });

  it("with an allotment, goes to freeze / float / slide, whatever came before", () => {
    const s = nextStep({ ...base, merit: null, allotment: { round: "II", choiceCode: "0627126310" } });
    expect([s.id, s.title, s.stage]).toEqual(["allotment", "Freeze, float or slide?", "Allotted in Round II"]);
  });

  it("once decided on that allotment, shares the family summary; a new round's allotment asks again", () => {
    const allotment = { round: "II" as const, choiceCode: "0627126310" };
    const progress = { ...EMPTY_PROGRESS, decided: { at, choiceCode: "0627126310", round: "II" } };
    expect(nextStep({ ...base, listSize: 3, allotment, progress }).id).toBe("summary");
    expect(decidedOn(progress, { round: "III", choiceCode: "0627126310" })).toBe(false);
    expect(nextStep({ ...base, listSize: 3, allotment: { round: "III", choiceCode: "0627126310" }, progress }).id).toBe("allotment");
  });

  it("names the step, never an outcome, and has at most one secondary link", () => {
    const states: StepState[] = [
      { ...base, merit: null }, base, { ...base, listSize: 2 },
      { ...base, listSize: 2, progress: { ...EMPTY_PROGRESS, simulatedAt: at } },
      { ...base, allotment: { round: "I", choiceCode: "1" } },
    ];
    for (const st of states) {
      const s = nextStep(st);
      expect(`${s.title} ${s.text} ${s.cta}`).not.toMatch(/guarantee|get your seat|\bsafe\b|will get/i);
    }
  });
});
