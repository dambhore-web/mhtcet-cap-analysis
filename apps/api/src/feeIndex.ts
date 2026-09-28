import { createRequire } from "module";
import type { AppCache } from "./startup.ts";

const require = createRequire(import.meta.url);
const RAW = require("./data/fees.json") as Record<string, unknown>;

export interface FeeEntry {
  name: string;
  /** 5-digit CAP college code, when the source gives it. */
  collegeCode?: string;
  tuitionFee: number;
  developmentFee: number;
  otherFees: number;
  totalAnnualFee: number;
  tfwsAvailable: boolean;
  tfwsSeats: number | null;
  fraOrderRef: string | null;
  fraOrderUrl: string | null;
  sampleOnly: boolean;
  /** FRA academic year of the amounts, e.g. "2026-27" (written by `npm run fees`). */
  academicYear?: string;
  fraInstituteId?: string;
  fraStatus?: string;
  fraMeetingDate?: string | null;
  /** The FRA report row this entry comes from. */
  sourceUrl?: string;
}

/** The FRA academic year of an entry; entries without one fall back to fees.json's `_meta.year`. */
export function feeYear(entry: FeeEntry): string {
  return entry.academicYear ?? (RAW._meta as { year?: string } | undefined)?.year ?? "unknown";
}

export interface FeeIndex {
  byCollege: Map<string, FeeEntry>;
  unmatched: string[];
  /** Entries whose amounts link to an FRA order. */
  verified: number;
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Matches fee entries to colleges in the cache: by explicit collegeCode first, then by exact
 * normalised name. Nothing is guessed; unmatched entries are reported, not shown.
 */
export function buildFeeIndex(cache: AppCache, raw: Record<string, unknown> = RAW): FeeIndex {
  const byName = new Map<string, string>();
  for (const c of cache.colleges.values()) byName.set(norm(c.name), c.code);

  const byCollege = new Map<string, FeeEntry>();
  const unmatched: string[] = [];
  let verified = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_")) continue;
    const e = value as FeeEntry;
    const code = e.collegeCode && cache.colleges.has(e.collegeCode) ? e.collegeCode : byName.get(norm(e.name));
    if (!code) {
      unmatched.push(e.name);
      continue;
    }
    byCollege.set(code, e);
    if (e.fraOrderUrl) verified++;
  }
  if (unmatched.length) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: "fees_unmatched", count: unmatched.length, names: unmatched }));
  }
  return { byCollege, unmatched, verified };
}
