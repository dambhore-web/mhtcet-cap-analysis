import type { Context } from "hono";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FEE_DATA = require("../data/fees.json") as Record<string, FeeEntry | undefined>;

interface FeeEntry {
  name: string;
  tuitionFee: number;
  developmentFee: number;
  otherFees: number;
  totalAnnualFee: number;
  tfwsAvailable: boolean;
  tfwsSeats: number | null;
  fraOrderRef: string | null;
  fraOrderUrl: string | null;
  sampleOnly: boolean;
}

/** GET /api/colleges/:code/fees */
export function getCollegeFees(c: Context) {
  const code = c.req.param("code") ?? "";
  const entry = FEE_DATA[code];

  if (!entry || (entry as unknown as { _meta: unknown })._meta) {
    return c.json({ available: false, code }, 200);
  }

  return c.json({
    available: true,
    code,
    name: entry.name,
    year: "2025-26",
    fees: {
      tuitionFee: entry.tuitionFee,
      developmentFee: entry.developmentFee,
      otherFees: entry.otherFees,
      totalAnnualFee: entry.totalAnnualFee,
    },
    tfwsAvailable: entry.tfwsAvailable,
    tfwsSeats: entry.tfwsSeats,
    fraOrderRef: entry.fraOrderRef,
    fraOrderUrl: entry.fraOrderUrl,
    sampleOnly: entry.sampleOnly,
    disclaimer: "Fee data from FRA 2025-26 approved orders. Verify with college before payment. Subject to revision.",
  });
}
