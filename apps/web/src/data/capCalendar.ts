import type { CapEvent } from "../lib/capCalendar";

/**
 * CAP dates for the coming admission year, entered by hand from CET Cell notices (#117, #139).
 * Every entry needs the notice it came from and the day it was checked; keep `provisional: true`
 * until the final schedule confirms it. Never guess a date: an empty list hides the timeline.
 *
 * CAP 2026 is over (Rounds I–IV loaded); the CAP 2027 schedule is not published yet.
 */
export const CAP_CALENDAR: { year: number; events: CapEvent[] } = {
  year: 2027,
  events: [],
};
