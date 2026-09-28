import type { Context } from "hono";
import { feeYear, type FeeIndex } from "../feeIndex.ts";
import type { AppCache } from "../startup.ts";

/** TFWS seats across a college's branches in the seat matrix (null when no matrix is loaded). */
export function collegeTfws(cache: AppCache, code: string): { seats: number; branches: number } | null {
  if (!cache.seats.size) return null;
  let seats = 0;
  let branches = 0;
  for (const [choiceCode, bySeat] of cache.seats) {
    if (cache.branches.get(choiceCode)?.collegeCode !== code) continue;
    const n = bySeat.get("TFWS") ?? 0;
    if (n > 0) { seats += n; branches++; }
  }
  return { seats, branches };
}

/** GET /api/colleges/:code/fees */
export function getCollegeFees(c: Context, index: FeeIndex, cache: AppCache) {
  const code = c.req.param("code") ?? "";
  const entry = index.byCollege.get(code);
  if (!entry) return c.json({ available: false, code }, 200);

  const verified = !!entry.fraOrderUrl;
  const tfws = collegeTfws(cache, code);
  return c.json({
    available: true,
    code,
    name: entry.name,
    year: feeYear(entry),
    fees: {
      tuitionFee: entry.tuitionFee,
      developmentFee: entry.developmentFee,
      otherFees: entry.otherFees,
      totalAnnualFee: entry.totalAnnualFee,
    },
    source: entry.source ?? "FRA",
    sourceUrl: entry.sourceUrl ?? null,
    // TFWS comes from the CAP seat matrix; the fee sources say nothing about it.
    tfwsAvailable: tfws ? tfws.seats > 0 : entry.tfwsAvailable,
    tfwsSeats: tfws ? tfws.seats : entry.tfwsSeats,
    tfwsBranches: tfws ? tfws.branches : null,
    fraOrderRef: entry.fraOrderRef,
    fraOrderUrl: entry.fraOrderUrl,
    sampleOnly: entry.sampleOnly,
    verified,
    disclaimer: verified
      ? "From the Fee Regulating Authority's approved fee order. Confirm with the college before paying."
      : "Not yet checked against the Fee Regulating Authority's order. Confirm with the college before paying.",
  });
}
