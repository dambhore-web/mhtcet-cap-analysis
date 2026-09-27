import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import "./CutoffChart.css";

interface CutoffRow {
  branch: string;
  seatType: string;
  round: number;
  closingMerit: number;
}

interface BranchSeries {
  branch: string;
  roundValues: (number | null)[];
  firstMerit: number;
  lastMerit: number;
}

const SEAT_NAMES: Record<string, string> = {
  GOPENS: "General Open", GOPENH: "General Open (HU)", GOPENO: "General Open (Other HU)",
  LOPENS: "Ladies Open", LOPENH: "Ladies Open (HU)", LOPENO: "Ladies Open (Other HU)",
  GOBCSS: "OBC", GOBCSH: "OBC (HU)", GOBCSO: "OBC (Other HU)",
  LOBCSS: "Ladies OBC", LOBCSH: "Ladies OBC (HU)",
  GOSCS: "SC", GOSCSH: "SC (HU)", GOSTS: "ST", GOSTH: "ST (HU)",
  GOVJS: "VJ/DT", GOVJIH: "VJ/DT (HU)",
  GONT1S: "NT-A", GONT1H: "NT-A (HU)", GONT2S: "NT-B", GONT2H: "NT-B (HU)",
  GONT3S: "NT-C", GONT3H: "NT-C (HU)",
  GOSEBCS: "SEBC", GOSEBCH: "SEBC (HU)",
  EWSS: "EWS", EWSH: "EWS (HU)", TFWS: "TFWS (Fee Waiver)",
  MI: "Minority", ORPHANI: "Orphan (AI)", ORPHANN: "Orphan (MH)",
  PWDS: "PwD", PWDH: "PwD (HU)", DEFS: "Defence", DEFH: "Defence (HU)",
  // mock-up style codes (without double suffix)
  GOBCS: "OBC", LOBCS: "Ladies OBC", GSCS: "SC", LSCS: "Ladies SC",
  GSTS: "ST", LSTS: "Ladies ST", GVJS: "VJ/DT", LVJS: "Ladies VJ/DT",
  GNT1S: "NT-A", LNT1S: "Ladies NT-A", GNT2S: "NT-B", LNT2S: "Ladies NT-B",
  GNT3S: "NT-C", LNT3S: "Ladies NT-C", GSEBCS: "SEBC", LSEBCS: "Ladies SEBC",
  EWS: "EWS", PWDOPENS: "PwD Open", PWDOBCS: "PwD OBC",
};

const PREFERRED_SEAT_TYPES = [
  "GOPENS", "GOPENH", "LOPENS", "TFWS", "EWS", "EWSS",
  "GOBCSS", "GOBCS", "LOBCSS", "LOBCS",
  "GOSEBCS", "GSEBCS", "GOSCS", "GSCS",
  "GOSTS", "GSTS",
];

const LOG_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 400000];

function bestLogBounds(min: number, max: number) {
  const a = LOG_TICKS.filter((t) => t <= min).at(-1) ?? LOG_TICKS[0];
  const z = LOG_TICKS.find((t) => t >= max) ?? LOG_TICKS.at(-1)!;
  return { a, z };
}

function xScale(v: number, a: number, z: number, left: number, width: number) {
  return left + ((Math.log(v) - Math.log(a)) / (Math.log(z) - Math.log(a))) * width;
}

function tickLabel(t: number) {
  if (t >= 1000) return `${t / 1000}k`;
  return String(t);
}

interface ChartSvgProps {
  series: BranchSeries[];
  availableRounds: number[];
  svgWidth: number;
}

function ChartSvg({ series, svgWidth }: ChartSvgProps) {
  const LEFT = 170;
  const RIGHT = 90;
  const ROW_H = 38;
  const TOP = 14;
  const BTM = 34;
  const CW = Math.max(svgWidth - LEFT - RIGHT, 1);
  const H = TOP + series.length * ROW_H + BTM;

  const allMerits = series.flatMap((s) => [s.firstMerit, s.lastMerit]);
  if (allMerits.length === 0) return null;
  const { a, z } = bestLogBounds(Math.min(...allMerits), Math.max(...allMerits));
  const xOf = (v: number) => xScale(v, a, z, LEFT, CW);
  const ticks = LOG_TICKS.filter((t) => t >= a && t <= z);

  return (
    <svg
      className="cc-svg"
      viewBox={`0 0 ${svgWidth} ${H}`}
      style={{ height: H }}
      role="img"
      aria-label="Closing merit by branch"
    >
      {/* Grid lines */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={xOf(t)} x2={xOf(t)}
            y1={TOP} y2={H - BTM}
            stroke="var(--line)"
          />
          <text
            x={xOf(t)} y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted)"
            fontFamily="Space Grotesk, monospace"
          >
            {tickLabel(t)}
          </text>
        </g>
      ))}

      {/* Branch rows */}
      {series.map((s, i) => {
        const cy = TOP + i * ROW_H + ROW_H / 2;
        const x1 = xOf(s.firstMerit);
        const x2 = xOf(s.lastMerit);
        const labelX = Math.max(x1, x2) + 10;
        const hasRange = s.firstMerit !== s.lastMerit;
        const branchLabel = s.branch.length > 22 ? s.branch.slice(0, 21) + "…" : s.branch;

        return (
          <g key={s.branch}>
            <text
              x={LEFT - 10}
              y={cy + 4}
              textAnchor="end"
              fontSize={12}
              fill="var(--navy)"
              fontFamily="DM Sans, sans-serif"
            >
              {branchLabel}
            </text>

            {hasRange && (
              <line
                x1={x1} x2={x2}
                y1={cy} y2={cy}
                stroke="var(--orange)"
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.45}
              />
            )}

            {/* Round I circle — outlined */}
            <circle cx={x1} cy={cy} r={5.5} fill="white" stroke="var(--violet)" strokeWidth={2}>
              <title>Round I: {s.firstMerit.toLocaleString("en-IN")}</title>
            </circle>

            {/* Last round circle — filled (only if different from R1) */}
            {hasRange && (
              <circle cx={x2} cy={cy} r={5.5} fill="var(--orange)">
                <title>Last round: {s.lastMerit.toLocaleString("en-IN")}</title>
              </circle>
            )}

            <text
              x={labelX}
              y={cy + 4}
              fontSize={11.5}
              fill="var(--navy)"
              fontFamily="Space Grotesk, monospace"
              fontWeight={600}
            >
              {s.lastMerit.toLocaleString("en-IN")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface CutoffChartProps {
  cutoffs: CutoffRow[];
}

export function CutoffChart({ cutoffs }: CutoffChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(600);

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      setSvgWidth(Math.max(containerRef.current.clientWidth, 320));
    }
  }, []);

  useEffect(() => {
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateWidth]);

  const availableSeatTypes = useMemo(() => {
    const set = new Set(cutoffs.map((r) => r.seatType));
    return PREFERRED_SEAT_TYPES.filter((st) => set.has(st)).concat(
      [...set].filter((st) => !PREFERRED_SEAT_TYPES.includes(st)).sort()
    );
  }, [cutoffs]);

  const [selectedSeatType, setSelectedSeatType] = useState<string>(() =>
    availableSeatTypes[0] ?? ""
  );

  // Keep selectedSeatType valid when data changes
  useEffect(() => {
    if (!availableSeatTypes.includes(selectedSeatType) && availableSeatTypes.length > 0) {
      setSelectedSeatType(availableSeatTypes[0]);
    }
  }, [availableSeatTypes, selectedSeatType]);

  const availableRounds = useMemo(() => {
    return [...new Set(cutoffs.map((r) => r.round))].sort((a, b) => a - b);
  }, [cutoffs]);

  const series = useMemo((): BranchSeries[] => {
    const rows = cutoffs.filter((r) => r.seatType === selectedSeatType);
    const branchMap = new Map<string, Map<number, number>>();
    for (const row of rows) {
      if (!branchMap.has(row.branch)) branchMap.set(row.branch, new Map());
      branchMap.get(row.branch)!.set(row.round, row.closingMerit);
    }

    return [...branchMap.entries()]
      .map(([branch, roundMap]) => {
        const roundValues = availableRounds.map((r) => roundMap.get(r) ?? null);
        const merits = roundValues.filter((v): v is number => v !== null);
        return {
          branch,
          roundValues,
          firstMerit: merits[0] ?? 0,
          lastMerit: merits.at(-1) ?? 0,
        };
      })
      .filter((s) => s.firstMerit > 0)
      .sort((a, b) => a.firstMerit - b.firstMerit);
  }, [cutoffs, selectedSeatType, availableRounds]);

  const ROUND_LABELS: Record<number, string> = { 1: "Round I", 2: "Round II", 3: "Round III", 4: "Round IV" };

  if (availableSeatTypes.length === 0) return null;

  return (
    <section className="cutoff-chart" aria-label="Cutoff visualization">
      <div className="cc-header">
        <span className="cc-eyebrow">Closing merit by branch</span>
        <p className="cc-desc">
          Lower merit number = harder to get in. Circle shows Round I; dot shows final round.
        </p>
      </div>

      {/* Seat type chips */}
      <div className="cc-chips" role="group" aria-label="Seat type">
        {availableSeatTypes.map((st) => (
          <button
            key={st}
            type="button"
            className={`cc-chip${selectedSeatType === st ? " active" : ""}`}
            aria-pressed={selectedSeatType === st}
            onClick={() => setSelectedSeatType(st)}
          >
            {SEAT_NAMES[st] ?? st}
          </button>
        ))}
      </div>

      {series.length === 0 ? (
        <div className="cc-empty">No data for {SEAT_NAMES[selectedSeatType] ?? selectedSeatType}</div>
      ) : (
        <>
          {/* Legend */}
          <div className="cc-legend">
            <span className="cc-legend-item">
              <span className="cc-dot cc-dot-r1" aria-hidden="true" />
              Round I closing
            </span>
            <span className="cc-legend-item">
              <span className="cc-dot cc-dot-last" aria-hidden="true" />
              Latest round closing
            </span>
          </div>

          {/* Chart */}
          <div className="cc-chart-wrap" ref={containerRef}>
            <ChartSvg series={series} availableRounds={availableRounds} svgWidth={svgWidth} />
          </div>

          {/* Table: branches × rounds */}
          <div className="cc-table-wrap">
            <table className="cc-table">
              <thead>
                <tr>
                  <th className="cc-th-branch">Branch</th>
                  {availableRounds.map((r) => (
                    <th key={r} className="cc-th-round">{ROUND_LABELS[r] ?? `R${r}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.branch}>
                    <td className="cc-td-branch">{s.branch}</td>
                    {s.roundValues.map((v, i) => {
                      const prevVal = i > 0 ? s.roundValues.slice(0, i).findLast((x) => x !== null) : undefined;
                      const prev = prevVal ?? null;
                      const delta = v !== null && prev !== null ? v - prev : null;
                      return (
                        <td key={i} className="cc-td-merit">
                          {v !== null ? (
                            <>
                              <span className="cc-merit-num">{v.toLocaleString("en-IN")}</span>
                              {delta !== null && delta !== 0 && (
                                <span className={`cc-delta${delta > 0 ? " up" : " dn"}`}>
                                  {delta > 0 ? `+${delta.toLocaleString("en-IN")}` : delta.toLocaleString("en-IN")}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="cc-merit-na">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
