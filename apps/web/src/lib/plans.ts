/**
 * Single source for plan names, prices and limits shown anywhere in the app.
 * Pricing is still an open decision (docs/DECISIONS.md) — change it here only.
 */
/**
 * Payments are deferred until the app sees real traffic (owner decision 2026-10-02, docs/DECISIONS.md).
 * While false, nothing in the app shows plans, prices or upgrade prompts, and /plans goes home.
 */
export const PAYMENTS_ENABLED = false;

export const PLANS = {
  free: {
    name: "Free",
    priceInr: 0,
    askQuestions: 3,
    features: [
      "Rank finder: unlimited searches",
      "All 387 colleges and their cutoff pages (every round)",
      "Option form with up to 300 choices (the CAP limit), CSV and PDF export",
      "Compare up to 3 colleges",
      "Shareable result links",
      "Parent summary PDF",
    ],
  },
  seasonPass: {
    name: "Season Pass",
    priceInr: 299,
    priceIsProvisional: true,
    validity: "2026–27 CAP cycle (Rounds I–IV)",
    askQuestions: "unlimited" as const,
    features: [
      "Everything in Free",
      "Ask GetMeCollege: unlimited questions",
      "CAP round simulator (Rounds I–III)",
      "Freeze / Float / Slide advisor",
    ],
  },
} as const;

export function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}
