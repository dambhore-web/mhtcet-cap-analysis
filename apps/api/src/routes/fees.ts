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

/**
 * Why a college has no fees on Compass (#42). The FRA (Fee Regulating Authority) approves the fees
 * of unaided private institutes only; government, government-aided, university and deemed
 * institutes have fees set by the state or the university, so they are never on its report.
 */
export type NoFeeReason = "state-set" | "not-on-fra-report" | "unknown";

const STATE_SET = /^(government|government-aided|deemed university|university)/i;

export function noFeeReason(collegeType: string | null | undefined): NoFeeReason {
  if (!collegeType) return "unknown";
  return STATE_SET.test(collegeType) ? "state-set" : "not-on-fra-report";
}

/** GET /api/colleges/:code/fees */
export function getCollegeFees(c: Context, index: FeeIndex, cache: AppCache) {
  const code = c.req.param("code") ?? "";
  const entry = index.byCollege.get(code);
  const tfws = collegeTfws(cache, code);
  if (!entry) {
    const collegeType = cache.colleges.get(code)?.collegeType ?? null;
    return c.json({
      available: false,
      code,
      collegeType,
      reason: noFeeReason(collegeType),
      // TFWS seats come from the seat matrix, so they are known even without fees
      tfwsSeats: tfws ? tfws.seats : null,
      tfwsBranches: tfws ? tfws.branches : null,
    }, 200);
  }

  // Official either way: the FRA's own fee order, or its published approved-fee report
  const fromOrder = !!entry.fraOrderUrl;
  const fromReport = !fromOrder && (entry.source ?? "FRA") === "FRA" && !!entry.sourceUrl;
  const verified = fromOrder || fromReport;
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
    basis: fromOrder ? "fra-order" : fromReport ? "fra-report" : "unverified",
    fraStatus: entry.fraStatus ?? null,
    disclaimer: fromOrder
      ? "From the Fee Regulating Authority's approved fee order. Confirm with the college before paying."
      : fromReport
        ? `From the Fee Regulating Authority's approved-fee report for ${feeYear(entry)}. Confirm with the college before paying.`
        : "Not yet checked against the Fee Regulating Authority. Confirm with the college before paying.",
  });
}
