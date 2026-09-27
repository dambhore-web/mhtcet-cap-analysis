import { formatNumber } from "../lib/format";
import "./MeritLadder.css";

const TICKS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 400000];

/** Log-scale domain that covers every value, snapped to round ticks. */
export function ladderDomain(values: number[]): [number, number] {
  const v = values.filter((x) => x > 0);
  if (v.length === 0) return [100, 400000];
  const lo = TICKS.filter((t) => t <= Math.min(...v)).at(-1) ?? TICKS[0];
  const hi = TICKS.find((t) => t >= Math.max(...v)) ?? TICKS[TICKS.length - 1];
  return [lo, hi === lo ? lo * 10 : hi];
}

export function ladderTicks([lo, hi]: [number, number]): number[] {
  return TICKS.filter((t) => t >= lo && t <= hi);
}

function pct(v: number, [lo, hi]: [number, number]): number {
  const x = (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  return Math.max(0, Math.min(100, x * 100));
}

interface Props {
  first: number | null;
  last: number | null;
  you: number | null;
  domain: [number, number];
  /** Short text for screen readers, e.g. the branch name. */
  label: string;
}

/**
 * One row of the merit ladder: Round I closing (filled dot) to last-round closing (ring),
 * with the student's merit as a vertical line. Lower numbers are on the left.
 */
export function MeritLadder({ first, last, you, domain, label }: Props) {
  const a = first ?? last;
  const b = last ?? first;
  if (a == null || b == null) return <span className="ladder ladder--empty">No closing rank</span>;
  const x1 = pct(a, domain);
  const x2 = pct(b, domain);
  const xu = you ? pct(you, domain) : null;
  const reach = you == null ? "" : you <= a ? ", within Round I" : you <= b ? ", within a later round" : ", beyond the last round";
  return (
    <span
      className="ladder"
      role="img"
      aria-label={`${label}: Round I closed at ${formatNumber(a)}, last round at ${formatNumber(b)}${you ? `; your merit ${formatNumber(you)}${reach}` : ""}`}
    >
      <span className="ladder-track" />
      {b !== a && <span className="ladder-span" style={{ left: `${Math.min(x1, x2)}%`, width: `${Math.abs(x2 - x1)}%` }} />}
      <span className="ladder-first" style={{ left: `${x1}%` }} />
      {b !== a && <span className="ladder-last" style={{ left: `${x2}%` }} />}
      {xu != null && <span className="ladder-you" style={{ left: `${xu}%` }} />}
    </span>
  );
}

/** Axis labels under a column of ladders. */
export function LadderAxis({ domain }: { domain: [number, number] }) {
  return (
    <span className="ladder-axis" aria-hidden="true">
      {ladderTicks(domain).map((t) => (
        <span key={t} style={{ left: `${pct(t, domain)}%` }}>{t >= 1000 ? `${t / 1000}k` : t}</span>
      ))}
    </span>
  );
}

export function LadderLegend({ showYou }: { showYou: boolean }) {
  return (
    <span className="ladder-legend">
      <span><span className="ladder-key ladder-key--first" />Round I closing</span>
      <span><span className="ladder-key ladder-key--last" />Last round closing</span>
      {showYou && <span><span className="ladder-key ladder-key--you" />Your merit</span>}
      <span className="ladder-legend-note">Lower number = harder to get</span>
    </span>
  );
}
