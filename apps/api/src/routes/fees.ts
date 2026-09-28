import type { Context } from "hono";
import type { AppCache } from "../startup.ts";
import type { FeeIndex } from "../feeIndex.ts";

export interface TfwsBranch {
  branch: string;
  choiceCode: string;
  /** Tightest Round I closing merit for TFWS in that branch, from the official cutoff list. */
  roundIClosing: number | null;
}

/**
 * Branches that offered tuition fee waiver (TFWS) seats this year, read from the official cutoff
 * lists: a TFWS closing merit means TFWS seats existed and were allotted. Seat counts need the
 * seat matrix (#40), so they aren't claimed here.
 */
export function tfwsBranches(cache: AppCache, collegeCode: string): TfwsBranch[] {
  const out: TfwsBranch[] = [];
  for (const [choiceCode, rows] of cache.cutoffsByChoiceCode) {
    const br = cache.branches.get(choiceCode);
    if (!br || br.collegeCode !== collegeCode) continue;
    const tfws = rows.filter((r) => r.list === "MH" && r.seatType === "TFWS");
    if (!tfws.length) continue;
    const roundI = tfws.filter((r) => r.round === "I").map((r) => r.closingMerit);
    out.push({ branch: br.name, choiceCode, roundIClosing: roundI.length ? Math.min(...roundI) : null });
  }
  return out.sort((a, b) => (a.roundIClosing ?? Infinity) - (b.roundIClosing ?? Infinity));
}

/** GET /api/colleges/:code/fees */
export function getCollegeFees(c: Context, cache: AppCache, index: FeeIndex) {
  const code = c.req.param("code") ?? "";
  const tfws = cache.colleges.has(code) ? tfwsBranches(cache, code) : [];
  const source = { name: index.source.name, url: index.source.url, year: index.source.year };
  const entry = index.byCollege.get(code);
  if (!entry) {
    return c.json({ available: false, code, source, tfws: { offered: tfws.length > 0, branches: tfws, seats: null } }, 200);
  }

  // Order-level check: the amounts link to the FRA order itself (the portal doesn't link orders)
  const verified = !!entry.fraOrderUrl;
  return c.json({
    available: true,
    code,
    name: entry.name,
    year: index.source.year,
    fees: {
      tuitionFee: entry.tuitionFee,
      developmentFee: entry.developmentFee,
      otherFees: entry.otherFees,
      totalAnnualFee: entry.totalAnnualFee,
    },
    // The cutoff lists are the stronger evidence; the curated flag only fills in when they're silent
    tfwsAvailable: tfws.length > 0 || entry.tfwsAvailable,
    tfwsSeats: entry.tfwsSeats,
    tfws: { offered: tfws.length > 0 || entry.tfwsAvailable, branches: tfws, seats: entry.tfwsSeats },
    fraOrderRef: entry.fraOrderRef,
    fraOrderUrl: entry.fraOrderUrl,
    sampleOnly: entry.sampleOnly,
    verified,
    source,
    disclaimer: verified
      ? `From the Fee Regulating Authority's approved fee order for ${index.source.year}. Confirm with the college before paying.`
      : `As published on the Fee Regulating Authority's portal for ${index.source.year}. Confirm with the college before paying.`,
  });
}
