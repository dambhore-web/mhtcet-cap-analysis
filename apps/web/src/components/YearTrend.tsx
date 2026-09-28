import { useMemo, useState } from "react";
import { formatNumber, formatRound } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel, seatTypeSortKey } from "../lib/seatType";
import { trendVerdict, yearSeries, yearsWithin, type HistoryRow, type RoundMode, type YearPoint } from "../lib/yearTrend";
import "./CutoffChart.css";
import "./YearTrend.css";

const W = 420;
const H = 190;
const PAD = { top: 26, right: 22, bottom: 30, left: 22 };

/** Line chart of one seat type's closing rank by year. Up means harder (a lower closing rank). */
function TrendChart({ points, merit, label }: { points: YearPoint[]; merit: number | null; label: string }) {
  const ranks = points.map((p) => p.closingMerit);
  const dataLo = Math.min(...ranks);
  const dataHi = Math.max(...ranks);
  // Draw the "you" line only when the merit is near the cutoffs; far away it would flatten the line.
  const near = merit != null && merit >= dataLo * 0.5 && merit <= dataHi * 1.5;
  const values = near ? ranks.concat(merit!) : ranks;
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  const pad = (hi0 - lo0) * 0.08 || Math.max(1, hi0 * 0.05);
  const lo = lo0 - pad;
  const span = hi0 + pad - lo;
  const x = (i: number) => PAD.left + (points.length === 1 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (points.length - 1));
  // Lower closing rank = harder = higher on the chart.
  const y = (v: number) => PAD.top + ((v - lo) / span) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.closingMerit).toFixed(1)}`).join(" ");
  const summary = points.map((p) => `${p.year}: ${formatNumber(p.closingMerit)}`).join(", ");

  return (
    <svg className="yt-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} closing rank by year. ${summary}.${merit ? ` Your merit ${formatNumber(merit)}.` : ""}`}>
      {near && (
        <g className="yt-you">
          <line x1={PAD.left} x2={W - PAD.right} y1={y(merit!)} y2={y(merit!)} />
          <text x={W - PAD.right} y={y(merit!) - 6} textAnchor="end">You {formatNumber(merit!)}</text>
        </g>
      )}
      <path d={path} className="yt-line" />
      {points.map((p, i) => (
        <g key={p.year}>
          <circle cx={x(i)} cy={y(p.closingMerit)} r={5} className="yt-dot" />
          <text x={x(i)} y={y(p.closingMerit) - 10} textAnchor="middle" className="yt-value">{formatNumber(p.closingMerit)}</text>
          <text x={x(i)} y={H - 10} textAnchor="middle" className="yt-year">{p.year}</text>
        </g>
      ))}
    </svg>
  );
}

const DIRECTION_TEXT = { harder: "got harder", easier: "got easier", steady: "stayed about the same" } as const;

/**
 * "Closing rank by year" for one branch: Round I or each year's last round, one seat type on the
 * chart, every seat type in the table, and a plain-language verdict.
 */
export function YearTrend({ rows, merit }: { rows: HistoryRow[]; merit: number | null }) {
  const [mode, setMode] = useState<RoundMode>("first");
  const seatTypes = useMemo(
    () => [...new Set(rows.map((r) => r.seatType))].sort((a, b) => seatTypeSortKey(a) - seatTypeSortKey(b)),
    [rows],
  );
  const [seatType, setSeatType] = useState<string>(() => (seatTypes.includes("GOPENS") ? "GOPENS" : seatTypes[0] ?? ""));
  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b), [rows]);
  const table = useMemo(() => seatTypes.map((st) => ({ seatType: st, points: yearSeries(rows, st, mode) })), [rows, seatTypes, mode]);
  const points = table.find((t) => t.seatType === seatType)?.points ?? [];
  const verdict = trendVerdict(points);
  const within = merit ? yearsWithin(points, merit) : [];

  if (years.length < 2) {
    return (
      <section className="card yt">
        <h2 className="label">Closing rank by year</h2>
        <p className="yt-empty">Only one year of cutoffs is loaded for this branch, so there's no year-on-year trend yet.</p>
      </section>
    );
  }

  const roundText = mode === "first" ? formatRound(1) : "the last round";
  return (
    <section className="card yt" aria-labelledby="yt-title">
      <div className="yt-head">
        <div>
          <h2 id="yt-title">Closing rank by year</h2>
          <p className="yt-desc">CAP {years[0]}–{years[years.length - 1]}, state-level lists. A lower closing rank means the branch was harder to get.</p>
        </div>
        <div className="yt-filters">
          <label className="yt-filter">
            <span className="label">Round</span>
            <select className="cc-select" value={mode} onChange={(e) => setMode(e.target.value as RoundMode)}>
              <option value="first">{formatRound(1)}</option>
              <option value="last">Last round of each year</option>
            </select>
          </label>
          <label className="yt-filter">
            <span className="label">Seat type</span>
            <select className="cc-select cc-select-branch" value={seatType} onChange={(e) => setSeatType(e.target.value)}>
              {seatTypes.map((st) => <option key={st} value={st}>{seatTypeLabel(st)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {verdict && (
        <p className={`yt-verdict yt-${verdict.direction}`}>
          <strong>{seatTypeLabel(seatType)}</strong> {DIRECTION_TEXT[verdict.direction]} in {roundText}: closed at{" "}
          {formatNumber(verdict.from.closingMerit)} in {verdict.from.year} and {formatNumber(verdict.to.closingMerit)} in {verdict.to.year}
          {verdict.direction !== "steady" && ` (${Math.round(Math.abs(verdict.change) * 100)}% ${verdict.direction === "harder" ? "lower" : "higher"})`}.
          {merit != null && (
            within.length === points.length
              ? ` Your merit ${formatNumber(merit)} was within the cutoff every year.`
              : within.length === 0
                ? ` Your merit ${formatNumber(merit)} was outside the cutoff every year.`
                : ` Your merit ${formatNumber(merit)} was within the cutoff in ${within.join(", ")}.`
          )}
        </p>
      )}

      {points.length > 0 ? (
        <figure className="yt-figure">
          <figcaption className="yt-axis-note">Higher on the chart = harder (lower closing rank)</figcaption>
          <TrendChart points={points} merit={merit} label={seatTypeShortLabel(seatType)} />
        </figure>
      ) : (
        <p className="yt-empty">No {seatTypeLabel(seatType)} seats in these years.</p>
      )}

      <div className="table-scroll">
        <table className="yt-table">
          <thead>
            <tr>
              <th scope="col">Seat type</th>
              {years.map((y) => <th key={y} scope="col" className="num">{y}</th>)}
              <th scope="col">Trend</th>
            </tr>
          </thead>
          <tbody>
            {table.map((t) => {
              const v = trendVerdict(t.points);
              return (
                <tr key={t.seatType} className={t.seatType === seatType ? "yt-selected" : undefined}>
                  <th scope="row"><abbr title={seatTypeLabel(t.seatType)}>{seatTypeShortLabel(t.seatType)}</abbr></th>
                  {years.map((y) => {
                    const p = t.points.find((q) => q.year === y);
                    return <td key={y} className="num" title={p ? formatRound(p.round) : undefined}>{p ? formatNumber(p.closingMerit) : "—"}</td>;
                  })}
                  <td className={v ? `yt-${v.direction}` : undefined}>{v ? DIRECTION_TEXT[v.direction].replace("stayed about the same", "steady").replace("got ", "") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mode === "last" && <p className="yt-note">CAP 2023 and 2024 had three rounds; 2025 and 2026 had four. "Last round" is each year's final round.</p>}
    </section>
  );
}
