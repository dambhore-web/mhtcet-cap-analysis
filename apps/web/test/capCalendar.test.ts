import { describe, expect, it } from "vitest";
import { formatSpan, isShowable, timeline, todayInIndia, type CapEvent } from "../src/lib/capCalendar";
import { CAP_CALENDAR } from "../src/data/capCalendar";

const ev = (id: string, start: string, end?: string, extra: Partial<CapEvent> = {}): CapEvent => ({
  id, label: id, start, end, sourceUrl: "https://cetcell.mahacet.org/notice.pdf", sourceTitle: "Notice", checkedOn: "2027-06-01", provisional: true, ...extra,
});

describe("CAP timeline (#139)", () => {
  it("marks past steps done, the first unfinished one current, the rest upcoming", () => {
    const rows = timeline([ev("c", "2027-07-20"), ev("a", "2027-07-01", "2027-07-05"), ev("b", "2027-07-10", "2027-07-14")], "2027-07-12");
    expect(rows.map((r) => `${r.event.id}:${r.state}`)).toEqual(["a:done", "b:current", "c:upcoming"]);
  });

  it("a step is current until its last day ends", () => {
    expect(timeline([ev("a", "2027-07-01", "2027-07-05")], "2027-07-05")[0].state).toBe("current");
    expect(timeline([ev("a", "2027-07-01", "2027-07-05")], "2027-07-06")[0].state).toBe("done");
  });

  it("never shows a date without a source link or a checked-on date", () => {
    expect(isShowable(ev("a", "2027-07-01", undefined, { sourceUrl: "" }))).toBe(false);
    expect(isShowable(ev("a", "2027-07-01", undefined, { checkedOn: "" }))).toBe(false);
    expect(isShowable(ev("a", "July 2027"))).toBe(false);
    expect(timeline([ev("a", "2027-07-01", undefined, { sourceUrl: "http://insecure" })], "2027-06-01")).toEqual([]);
  });

  it("ships with no guessed dates: every entry in the data is showable", () => {
    for (const e of CAP_CALENDAR.events) expect(isShowable(e), e.id).toBe(true);
  });

  it("formats day spans", () => {
    expect(formatSpan("2027-07-12")).toBe("12 Jul");
    expect(formatSpan("2027-07-12", "2027-07-15")).toBe("12–15 Jul");
    expect(formatSpan("2027-07-30", "2027-08-02")).toBe("30 Jul – 2 Aug");
  });

  it("uses India's date", () => {
    expect(todayInIndia(new Date("2027-07-11T20:00:00Z"))).toBe("2027-07-12"); // 01:30 IST next day
  });
});
