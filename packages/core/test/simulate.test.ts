import { describe, expect, it } from "vitest";
import { autoFreezes, firstFreezeRound, simulateCap, type SeatAvailability } from "../src/index.ts";

const seat = (closingMerit = 1000) => ({ seatType: "GOPENS", closingMerit });

describe("auto-freeze rule", () => {
  it("freezes option 1 in Round I, 1–3 in Round II, 1–6 in Round III, everything in Round IV", () => {
    expect(autoFreezes("I", 1)).toBe(true);
    expect(autoFreezes("I", 2)).toBe(false);
    expect(autoFreezes("II", 3)).toBe(true);
    expect(autoFreezes("II", 4)).toBe(false);
    expect(autoFreezes("III", 6)).toBe(true);
    expect(autoFreezes("III", 7)).toBe(false);
    expect(autoFreezes("IV", 40)).toBe(true);
  });

  it("names the first round whose zone includes a preference", () => {
    expect(firstFreezeRound(1)).toBe("I");
    expect(firstFreezeRound(2)).toBe("II");
    expect(firstFreezeRound(6)).toBe("III");
    expect(firstFreezeRound(7)).toBeNull();
  });
});

describe("simulateCap", () => {
  it("allots nothing when no preference has a seat", () => {
    const r = simulateCap([{}, {}]);
    expect(r.map((x) => x.preference)).toEqual([null, null, null, null]);
  });

  it("freezes a first-choice seat in Round I and stops there", () => {
    const seats: SeatAvailability = [{ I: seat(), II: seat(), III: seat(), IV: seat() }];
    const r = simulateCap(seats);
    expect(r[0]).toMatchObject({ round: "I", preference: 1, frozen: true });
    expect(r.slice(1).every((x) => x.frozenEarlier && x.preference === 1)).toBe(true);
  });

  it("floats up from option 4 and freezes once inside the Round II zone", () => {
    // option 3 opens in Round II, option 1 only in Round IV
    const seats: SeatAvailability = [
      { IV: seat(500) },
      {},
      { II: seat(800), III: seat(850), IV: seat(900) },
      { I: seat(1200), II: seat(1250), III: seat(1300), IV: seat(1400) },
    ];
    const r = simulateCap(seats);
    expect(r.map((x) => x.preference)).toEqual([4, 3, 3, 3]);
    expect(r[0].frozen).toBe(false);
    expect(r[1]).toMatchObject({ movedUp: true, frozen: true });
    expect(r[3].frozenEarlier).toBe(true);
  });

  it("does not freeze option 4 in Round II but does move it in Round III", () => {
    const seats: SeatAvailability = [
      {}, {}, {},
      {},
      { II: seat(), III: seat(), IV: seat() },
      { III: seat() },
      { I: seat(), II: seat(), III: seat(), IV: seat() },
    ];
    // Round I: option 7. Round II: option 5 (not in 1–3 zone). Round III: option 5 is in 1–6 zone → frozen.
    const r = simulateCap(seats);
    expect(r.map((x) => x.preference)).toEqual([7, 5, 5, 5]);
    expect(r[1].frozen).toBe(false);
    expect(r[2].frozen).toBe(true);
  });

  it("keeps the held seat when nothing higher opens, and freezes in Round IV", () => {
    const seats: SeatAvailability = [{}, { I: seat(), II: seat(), III: seat(), IV: seat() }];
    // Option 2 in Round I is outside the zone; Round II zone is 1–3, so it freezes then.
    const r = simulateCap(seats);
    expect(r[0]).toMatchObject({ preference: 2, frozen: false });
    expect(r[1]).toMatchObject({ preference: 2, frozen: true, movedUp: false });
  });

  it("never drops to a lower preference", () => {
    const seats: SeatAvailability = [{}, {}, {}, {}, {}, {}, {}, { I: seat() }, { II: seat(), III: seat(), IV: seat() }];
    const r = simulateCap(seats);
    expect(r.map((x) => x.preference)).toEqual([8, 8, 8, 8]);
    expect(r[3].frozen).toBe(true);
  });
});
