import type { Context } from "hono";
import { feeYear, type FeeIndex } from "../feeIndex.ts";

/** GET /api/colleges/:code/fees */
export function getCollegeFees(c: Context, index: FeeIndex) {
  const code = c.req.param("code") ?? "";
  const entry = index.byCollege.get(code);
  if (!entry) return c.json({ available: false, code }, 200);

  const verified = !!entry.fraOrderUrl;
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
    tfwsAvailable: entry.tfwsAvailable,
    tfwsSeats: entry.tfwsSeats,
    fraOrderRef: entry.fraOrderRef,
    fraOrderUrl: entry.fraOrderUrl,
    sampleOnly: entry.sampleOnly,
    verified,
    disclaimer: verified
      ? "From the Fee Regulating Authority's approved fee order. Confirm with the college before paying."
      : "Not yet checked against the Fee Regulating Authority's order. Confirm with the college before paying.",
  });
}
