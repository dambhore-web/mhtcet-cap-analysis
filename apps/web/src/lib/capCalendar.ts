/** One dated step of CAP, from a CET Cell notice (#139). Dates are YYYY-MM-DD, India time. */
export interface CapEvent {
  id: string;
  label: string;
  start: string;
  /** last day, for steps that run over several days */
  end?: string;
  sourceUrl: string;
  /** the notice's title, for the link */
  sourceTitle: string;
  /** the day someone checked the date against the notice */
  checkedOn: string;
  /** true until the final schedule confirms it */
  provisional: boolean;
}

export type EventState = "done" | "current" | "upcoming";

export interface TimelineRow {
  event: CapEvent;
  state: EventState;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Only events with a real date, a source link and a checked-on date are shown. */
export function isShowable(e: CapEvent): boolean {
  return DATE.test(e.start) && (!e.end || DATE.test(e.end)) && /^https:\/\//.test(e.sourceUrl) && DATE.test(e.checkedOn);
}

/**
 * The timeline in date order, with the current step: the first one that hasn't ended yet. `today`
 * is YYYY-MM-DD. Empty when nothing is showable (the timeline is then hidden).
 */
export function timeline(events: CapEvent[], today: string): TimelineRow[] {
  const rows = events.filter(isShowable).sort((a, b) => a.start.localeCompare(b.start));
  let currentFound = false;
  return rows.map((event) => {
    const last = event.end ?? event.start;
    if (last < today) return { event, state: "done" as const };
    if (!currentFound) {
      currentFound = true;
      return { event, state: "current" as const };
    }
    return { event, state: "upcoming" as const };
  });
}

/** Today in India (CAP runs on IST), as YYYY-MM-DD. */
export function todayInIndia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "12 Jul" or "12–15 Jul" or "30 Jul – 2 Aug". */
export function formatSpan(start: string, end?: string): string {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const day = (s: string) => d(s).getUTCDate();
  const mon = (s: string) => d(s).toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
  if (!end || end === start) return `${day(start)} ${mon(start)}`;
  if (mon(start) === mon(end)) return `${day(start)}–${day(end)} ${mon(end)}`;
  return `${day(start)} ${mon(start)} – ${day(end)} ${mon(end)}`;
}
