/**
 * Log-scale helpers shared by the merit ruler and the dumbbell charts. Closing ranks run from
 * single digits to lakhs, so every rank axis in the app is logarithmic.
 */

export const LOG_TICKS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 400000] as const;

/** The tightest [low, high] pair of LOG_TICKS that contains every value. */
export function logBounds(values: number[]): [number, number] {
  const finite = values.filter((v) => Number.isFinite(v) && v > 0);
  if (finite.length === 0) return [LOG_TICKS[0], LOG_TICKS[LOG_TICKS.length - 1]];
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const a = [...LOG_TICKS].reverse().find((t) => t <= lo) ?? LOG_TICKS[0];
  const z = LOG_TICKS.find((t) => t >= hi) ?? LOG_TICKS[LOG_TICKS.length - 1];
  return [a, z === a ? LOG_TICKS[Math.min(LOG_TICKS.indexOf(a) + 1, LOG_TICKS.length - 1)] : z];
}

export interface LogScale {
  (v: number): number;
  invert(px: number): number;
}

/** Maps a value in [a, z] to [x0, x0 + width] on a log scale; values outside are clamped. */
export function logScale([a, z]: [number, number], x0: number, width: number): LogScale {
  const la = Math.log(a);
  const span = Math.log(z) - la || 1;
  const f = ((v: number) => x0 + ((Math.log(Math.min(Math.max(v, a), z)) - la) / span) * width) as LogScale;
  f.invert = (px: number) => Math.exp(la + ((px - x0) / width) * span);
  return f;
}

/** Axis label for a tick: 500, 1k, 20k. */
export function tickLabel(t: number): string {
  return t >= 1000 ? `${t / 1000}k` : String(t);
}

/** Ticks inside [a, z]; on narrow charts every other one, always keeping the last. */
export function ticksIn([a, z]: [number, number], narrow = false): number[] {
  const all = LOG_TICKS.filter((t) => t >= a && t <= z);
  return narrow ? all.filter((_, i) => i % 2 === 0 || i === all.length - 1) : all;
}

/** A dragged merit number, rounded to a step that suits its size (1, 5, 10 or 50). */
export function roundMerit(v: number): number {
  const step = v < 200 ? 1 : v < 1000 ? 5 : v < 20000 ? 10 : 50;
  return Math.max(1, Math.round(v / step) * step);
}

/** Arrow-key step for the merit pin: smaller near the top of the merit list. */
export function meritStep(merit: number, big = false): number {
  if (big) return merit < 1000 ? 100 : 1000;
  return merit < 1000 ? 10 : merit < 20000 ? 100 : 500;
}
