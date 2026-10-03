import type { PlacementBatch } from "./api";

/** "₹11.2 lakh" / "₹85,000" style salary, as Indian readers quote packages. */
export function formatLakh(rupees: number): string {
  if (rupees < 100_000) return `₹${rupees.toLocaleString("en-IN")}`;
  const lakh = rupees / 100_000;
  return `₹${lakh >= 100 ? Math.round(lakh) : Math.round(lakh * 10) / 10} lakh`;
}

/** The newest batch with a placement figure, for the headline. */
export function latestPlaced(batches: PlacementBatch[]): PlacementBatch | null {
  for (let i = batches.length - 1; i >= 0; i--) if (batches[i].placed !== null) return batches[i];
  return null;
}

/** Newest batches first, at most `n`, for the table. */
export function recentBatches(batches: PlacementBatch[], n = 5): PlacementBatch[] {
  return [...batches].reverse().slice(0, n);
}

/**
 * Change in median salary between the oldest and newest shown batches with a salary, as a fraction
 * (0.1 = 10% higher). Null when fewer than two batches report one.
 */
export function salaryChange(batches: PlacementBatch[]): { from: PlacementBatch; to: PlacementBatch; change: number } | null {
  const withSalary = batches.filter((b) => b.medianSalary !== null);
  if (withSalary.length < 2) return null;
  const from = withSalary[0];
  const to = withSalary[withSalary.length - 1];
  return { from, to, change: (to.medianSalary! - from.medianSalary!) / from.medianSalary! };
}
