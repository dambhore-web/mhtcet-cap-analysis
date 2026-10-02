import type { ReactNode } from "react";
import { formatNumber, formatRound } from "../lib/format";
import { logScale } from "../lib/logScale";
import { useWidth } from "../lib/useWidth";
import { seatTypeLabel } from "../lib/seatType";
import { trendVerdict, yearSeries, type HistoryRow, type RoundMode } from "../lib/yearTrend";
import "./YearTrend.css";

/** Round-number ticks (1, 1.5, 2, 3, 5, 7 × 10ⁿ) for a narrow rank range; at most 7. */
function niceTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let p = 1; p <= 1e6; p *= 10) for (const m of [1, 1.5, 2, 3, 5, 7]) if (m * p >= lo && m * p <= hi) out.push(m * p);
  let t = out;
  while (t.length > 7) t = t.filter((_, i) => i % 2 === 0);
  return t;
}

function niceLabel(t: number): string {
  return t >= 1000 ? `${(t / 1000).toLocaleString("en-IN")}k` : String(t);
}

/**
 * One vertical dumbbell per year for one seat type: Round I (hollow blue) to the final round
 * (amber). No line joins the years. Higher on the chart = harder (a lower closing rank).
 */
export function YearDumbbells({ rows, seatType, merit }: { rows: HistoryRow[]; seatType: string; merit: number | null }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const first = yearSeries(rows, seatType, "first");
  const last = yearSeries(rows, seatType, "last");
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const W = width || 600;
  const narrow = W < 520;
  const L = narrow ? 44 : 56, R = 24, T = 22, B = 34, H = narrow ? 230 : 270;
  const vals = [...first, ...last].map((p) => p.closingMerit).concat(merit ?? []);
  const dom: [number, number] = vals.length ? [Math.min(...vals) / 1.25, Math.max(...vals) * 1.25] : [10, 100];
  // log scale on the vertical axis, low ranks (harder) at the top
  const y = logScale(dom, T, H - T - B);
  const x = (k: number) => L + ((k + 0.5) / Math.max(years.length, 1)) * (W - L - R);
  const ticks = niceTicks(dom[0], dom[1]);
  const summary = years.map((yr) => {
    const a = first.find((p) => p.year === yr), b = last.find((p) => p.year === yr);
    return `${yr}: Round I ${a ? formatNumber(a.closingMerit) : "none"}, final ${b ? formatNumber(b.closingMerit) : "none"}`;
  }).join("; ");

  return (
    <div ref={ref} className="yt-chart-wrap">
      {width > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label={`${seatTypeLabel(seatType)} closing rank by year. ${summary}.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="yt-grid" />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" className="yt-axis">{niceLabel(t)}</text>
            </g>
          ))}
          {years.map((yr, k) => <text key={yr} x={x(k)} y={H - 10} textAnchor="middle" className="yt-year">{yr}</text>)}
          {merit != null && (
            <g>
              <line x1={L} x2={W - R} y1={y(merit)} y2={y(merit)} className="yt-you" />
              <text x={W - R} y={y(merit) - 6} textAnchor="end" className="yt-you-label">You {formatNumber(merit)}</text>
            </g>
          )}
          {years.map((yr, k) => {
            const a = first.find((p) => p.year === yr)?.closingMerit;
            const b = last.find((p) => p.year === yr)?.closingMerit;
            const cx = x(k);
            if (a == null && b == null) return <text key={yr} x={cx} y={(T + H - B) / 2} textAnchor="middle" className="yt-none">no seats</text>;
            return (
              <g key={yr}>
                <title>{`${yr}: Round I ${a != null ? formatNumber(a) : "—"}, final round ${b != null ? formatNumber(b) : "—"}`}</title>
                {a != null && b != null && a !== b && <line x1={cx} x2={cx} y1={y(a)} y2={y(b)} className="yt-bar" />}
                {b != null && b !== a && (
                  <>
                    <circle cx={cx} cy={y(b)} r={6} className="yt-last" />
                    <text x={cx + 12} y={y(b) + 4} className="yt-val yt-val-last">{formatNumber(b)}</text>
                  </>
                )}
                {a != null && (
                  <>
                    <circle cx={cx} cy={y(a)} r={6} className="yt-first" />
                    <text x={cx - 12} y={y(a) + 4} textAnchor="end" className="yt-val yt-val-first">{formatNumber(a)}</text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

const YEAR_SHADES = ["#bfdbfe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"];

/**
 * Every seat type in one chart: a row each, with a dot per year (pale = oldest, dark = newest) on a
 * log scale. Rows are sorted hardest first; clicking a row picks that seat type.
 */
export function SeatTrails({ rows, mode, selected, merit, onSelect }: { rows: HistoryRow[]; mode: RoundMode; selected: string; merit: number | null; onSelect: (seatType: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const seats = [...new Set(rows.map((r) => r.seatType))]
    .map((st) => ({ st, pts: yearSeries(rows, st, mode) }))
    .filter((s) => s.pts.length > 0)
    .sort((p, q) => Math.min(...p.pts.map((x) => x.closingMerit)) - Math.min(...q.pts.map((x) => x.closingMerit)));
  const W = width || 600, narrow = W < 520;
  const LEFT = narrow ? 112 : 190, RIGHT = narrow ? 52 : 70, ROW = 30, TOP = 6, BTM = 30;
  const H = TOP + seats.length * ROW + BTM;
  const vals = seats.flatMap((s) => s.pts.map((p) => p.closingMerit)).concat(merit ?? []);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const dom: [number, number] = [Math.max(1, lo / 1.2), hi * 1.2];
  const x = logScale(dom, LEFT, W - LEFT - RIGHT);
  const ticks = niceTicks(dom[0], dom[1]).filter((_, i, a) => !narrow || i % 2 === 0 || i === a.length - 1);
  // newest year darkest; with fewer than four years the palest shades are skipped
  const shadeFor = (yr: number) => YEAR_SHADES[Math.min(years.indexOf(yr) + Math.max(0, 4 - years.length), YEAR_SHADES.length - 1)];
  const maxLabel = narrow ? 14 : 26;

  return (
    <div ref={ref} className="yt-chart-wrap">
      <div className="yt-years">
        {years.map((yr) => <span key={yr}><i style={{ background: shadeFor(yr) }} />{yr}</span>)}
        {merit != null && <span><i className="yt-dash" />You</span>}
      </div>
      {width > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label="Closing rank for each seat type, by year">
          {seats.map((s, i) => (
            <rect key={s.st} x={0} y={TOP + i * ROW} width={W} height={ROW} className={s.st === selected ? "yt-row-on" : i % 2 === 0 ? "yt-row-alt" : "yt-row"} />
          ))}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={TOP} y2={H - BTM} className="yt-grid" />
              <text x={x(t)} y={H - BTM + 16} textAnchor="middle" className="yt-axis">{niceLabel(t)}</text>
            </g>
          ))}
          {seats.map((s, i) => {
            const cy = TOP + i * ROW + ROW / 2;
            const v = trendVerdict(s.pts);
            const label = seatTypeLabel(s.st);
            const pick = () => onSelect(s.st);
            return (
              <g
                key={s.st}
                className="yt-trow"
                tabIndex={0}
                role="button"
                aria-pressed={s.st === selected}
                aria-label={`${label}: ${s.pts.map((p) => `${p.year} ${formatNumber(p.closingMerit)}`).join(", ")}`}
                onClick={pick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
              >
                <rect x={0} y={cy - ROW / 2} width={W} height={ROW} fill="transparent" />
                <text x={LEFT - 12} y={cy + 4} textAnchor="end" className={s.st === selected ? "yt-tlabel on" : "yt-tlabel"}>
                  {label.length > maxLabel ? label.slice(0, maxLabel - 1) + "…" : label}
                </text>
                {s.pts.length > 1 && <polyline points={s.pts.map((p) => `${x(p.closingMerit)},${cy}`).join(" ")} className="yt-trail" />}
                {s.pts.map((p) => (
                  <circle key={p.year} cx={x(p.closingMerit)} cy={cy} r={p.year === years[years.length - 1] ? 5.5 : 4} fill={shadeFor(p.year)} stroke="#fff" strokeWidth={1} />
                ))}
                {v && <text x={W - RIGHT + 10} y={cy + 4} className={`yt-verdict-tag ${v.direction}`}>{v.direction}</text>}
              </g>
            );
          })}
          {merit != null && <line x1={x(merit)} x2={x(merit)} y1={TOP - 2} y2={H - BTM} className="yt-you" />}
        </svg>
      )}
    </div>
  );
}

/** Every seat type's closing rank by year, as a table (folded under the trails chart). */
export function YearTable({ rows, mode, caption }: { rows: HistoryRow[]; mode: RoundMode; caption?: ReactNode }) {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const seats = [...new Set(rows.map((r) => r.seatType))]
    .map((st) => ({ st, pts: yearSeries(rows, st, mode) }))
    .filter((s) => s.pts.length > 0)
    .sort((p, q) => Math.min(...p.pts.map((x) => x.closingMerit)) - Math.min(...q.pts.map((x) => x.closingMerit)));
  return (
    <details className="yt-table-toggle">
      <summary>Show as a table</summary>
      <div className="table-scroll">
        <table className="yt-table">
          {caption && <caption>{caption}</caption>}
          <thead>
            <tr>
              <th scope="col">Seat type</th>
              {years.map((y) => <th key={y} scope="col" className="num">{y}</th>)}
              <th scope="col">Trend</th>
            </tr>
          </thead>
          <tbody>
            {seats.map((s) => {
              const v = trendVerdict(s.pts);
              return (
                <tr key={s.st}>
                  <th scope="row">{seatTypeLabel(s.st)}</th>
                  {years.map((y) => {
                    const p = s.pts.find((q) => q.year === y);
                    return <td key={y} className="num" title={p ? formatRound(p.round) : undefined}>{p ? formatNumber(p.closingMerit) : "—"}</td>;
                  })}
                  <td className={v ? `yt-${v.direction}` : undefined}>{v?.direction ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mode === "last" && <p className="yt-note">CAP 2023 and 2024 had three rounds; 2025 and 2026 had four. "Last round" is each year's final round.</p>}
    </details>
  );
}

