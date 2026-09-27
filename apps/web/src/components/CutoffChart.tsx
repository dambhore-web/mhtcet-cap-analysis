import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { seatCategoryLabel, seatTypeShortLabel, seatLevelCode, seatTypeSortKey, LEVEL_LABELS } from "../lib/seatType";
import { formatNumber, formatRound, roundIndex } from "../lib/format";
import "./CutoffChart.css";

interface CutoffRow {
  branch: string;
  seatType: string;
  round: number | string;
  closingMerit: number;
  list?: string;
  source?: string | null;
  sourcePage?: number | null;
}

/** The same values as a chart, as a table: reachable by keyboard, touch and screen readers. */
function SeriesTable({ series, rounds, rowHeader, sources }: { series: ChartSeries[]; rounds: (number | string)[]; rowHeader: string; sources: string[] }) {
  return (
    <details className="cc-table-toggle">
      <summary>Show as a table</summary>
      <div className="table-scroll">
        <table className="cc-table">
          <thead>
            <tr>
              <th scope="col">{rowHeader}</th>
              {rounds.map((r) => <th key={String(r)} scope="col" className="cc-num">{formatRound(r)}</th>)}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.label}>
                <th scope="row">{s.label}</th>
                {s.roundValues.map((v, i) => <td key={i} className="cc-num">{v == null ? "—" : formatNumber(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sources.length > 0 && (
        <p className="cc-sources">Source: {sources.join("; ")}</p>
      )}
    </details>
  );
}

/** "file.pdf (pages 12, 14)" for the rows behind a chart (NFR-001). */
function sourceNotes(rows: CutoffRow[]): string[] {
  const pages = new Map<string, Set<number>>();
  for (const r of rows) {
    if (!r.source) continue;
    if (!pages.has(r.source)) pages.set(r.source, new Set());
    if (r.sourcePage != null) pages.get(r.source)!.add(r.sourcePage);
  }
  return [...pages.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, ps]) => (ps.size ? `${file} (page ${[...ps].sort((a, b) => a - b).join(", ")})` : file));
}

interface ChartSeries {
  label: string;
  roundValues: (number | null)[];
  firstMerit: number;
  lastMerit: number;
}

const LOG_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 400000];
const LEVEL_ORDER = ["S", "H", "O"] as const;

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

// ─── Shared SVG renderer ──────────────────────────────────────────────────────

interface ChartSvgProps {
  series: ChartSeries[];
  svgWidth: number;
  hoveredIdx: number | null;
  onRowEnter: (idx: number) => void;
  onRowLeave: () => void;
}

function ChartSvg({ series, svgWidth, hoveredIdx, onRowEnter, onRowLeave }: ChartSvgProps) {
  const narrow = svgWidth < 520;
  const LEFT = narrow ? 112 : 170;
  const RIGHT = narrow ? 60 : 90;
  const ROW_H = 38;
  const TOP = 14;
  const BTM = 34;
  const CW = Math.max(svgWidth - LEFT - RIGHT, 1);
  const H = TOP + series.length * ROW_H + BTM;

  const allMerits = series.flatMap((s) => [s.firstMerit, s.lastMerit]);
  if (allMerits.length === 0) return null;
  const { a, z } = bestLogBounds(Math.min(...allMerits), Math.max(...allMerits));
  const xOf = (v: number) => xScale(v, a, z, LEFT, CW);
  const allTicks = LOG_TICKS.filter((t) => t >= a && t <= z);
  const ticks = narrow ? allTicks.filter((_, i) => i % 2 === 0 || i === allTicks.length - 1) : allTicks;

  return (
    <svg
      className="cc-svg"
      viewBox={`0 0 ${svgWidth} ${H}`}
      style={{ height: H }}
      role="img"
      aria-label="Closing merit chart"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={xOf(t)} x2={xOf(t)} y1={TOP} y2={H - BTM} stroke="var(--line)" />
          <text x={xOf(t)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--muted)" fontFamily="var(--font-num)">
            {tickLabel(t)}
          </text>
        </g>
      ))}

      {series.map((s, i) => {
        const cy = TOP + i * ROW_H + ROW_H / 2;
        const x1 = xOf(s.firstMerit);
        const x2 = xOf(s.lastMerit);
        const hasRange = s.firstMerit !== s.lastMerit;
        const maxChars = narrow ? 14 : 22;
        const rowLabel = s.label.length > maxChars ? s.label.slice(0, maxChars - 1) + "…" : s.label;
        const isHov = hoveredIdx === i;

        return (
          <g key={s.label}>
            <rect
              x={0} y={cy - ROW_H / 2}
              width={svgWidth} height={ROW_H}
              fill="transparent"
              onMouseEnter={() => onRowEnter(i)}
              onMouseLeave={onRowLeave}
            />
            {isHov && (
              <rect
                x={0} y={cy - ROW_H / 2}
                width={svgWidth} height={ROW_H}
                fill="var(--lavender)" opacity={0.6}
                style={{ pointerEvents: "none" }}
              />
            )}

            <text
              x={LEFT - 10} y={cy + 4}
              textAnchor="end" fontSize={12}
              fill={isHov ? "var(--violet)" : "var(--navy)"}
              fontFamily="var(--font-body)"
              style={{ pointerEvents: "none" }}
            >
              <title>{s.label}</title>
              {rowLabel}
            </text>

            {hasRange && (
              <line
                x1={x1} x2={x2} y1={cy} y2={cy}
                stroke="var(--orange)" strokeWidth={3} strokeLinecap="round" opacity={0.45}
                style={{ pointerEvents: "none" }}
              />
            )}

            <circle cx={x1} cy={cy} r={5.5} fill="var(--white)" stroke="var(--violet)" strokeWidth={2} style={{ pointerEvents: "none" }}>
              <title>{formatRound(1)}: {formatNumber(s.firstMerit)}</title>
            </circle>

            {hasRange && (
              <circle cx={x2} cy={cy} r={5.5} fill="var(--orange)" style={{ pointerEvents: "none" }}>
                <title>Last round: {formatNumber(s.lastMerit)}</title>
              </circle>
            )}

            <text
              x={LEFT + CW + 8} y={cy + 4}
              fontSize={11} fill="var(--muted)"
              fontFamily="var(--font-num)" fontWeight={600}
              style={{ pointerEvents: "none" }}
            >
              {formatNumber(s.lastMerit)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  series: ChartSeries;
  rounds: (number | string)[];
  x: number;
  y: number;
  maxX: number;
}

function ChartTooltip({ series, rounds, x, y, maxX }: TooltipProps) {
  const TW = 180;
  const left = x + 14 + TW > maxX ? x - TW - 6 : x + 14;
  return (
    <div className="cc-tooltip" style={{ left, top: Math.max(y - 8, 0) }}>
      <div className="cc-tooltip-label">{series.label}</div>
      {rounds.map((r, i) => {
        const v = series.roundValues[i];
        return v !== null ? (
          <div key={i} className="cc-tooltip-row">
            <span>{formatRound(r)}</span>
            <span className="cc-tooltip-val">{formatNumber(v)}</span>
          </div>
        ) : null;
      })}
    </div>
  );
}

// ─── Shared hooks ─────────────────────────────────────────────────────────────

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(600);
  const update = useCallback(() => {
    if (ref.current) setWidth(Math.max(ref.current.clientWidth, 260));
  }, [ref]);
  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [update]);
  return width;
}

function useTooltip() {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);
  const onMouseLeave = useCallback(() => setHovered(null), []);
  return { hovered, setHovered, pos, onMouseMove, onMouseLeave };
}

// ─── CutoffChart — branches, two filters: level + reservation category ────────

interface CutoffChartProps {
  cutoffs: CutoffRow[];
}

export function CutoffChart({ cutoffs }: CutoffChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWidth = useContainerWidth(containerRef);
  const { hovered, setHovered, pos, onMouseMove, onMouseLeave } = useTooltip();

  const availableLevels = useMemo(() => {
    const set = new Set<string>();
    for (const r of cutoffs) set.add(seatLevelCode(r.seatType) ?? "S");
    return LEVEL_ORDER.filter((l) => set.has(l));
  }, [cutoffs]);

  const [selectedLevel, setSelectedLevel] = useState<string>("all");

  // Seat types available at the selected level (for the category dropdown)
  const seatTypesAtLevel = useMemo(() => {
    return [...new Set(
      cutoffs
        .filter((r) => selectedLevel === "all" || (seatLevelCode(r.seatType) ?? "S") === selectedLevel)
        .map((r) => r.seatType)
    )].sort((a, b) => seatTypeSortKey(a) - seatTypeSortKey(b));
  }, [cutoffs, selectedLevel]);

  const [selectedSeatType, setSelectedSeatType] = useState<string>(() => seatTypesAtLevel[0] ?? "");

  // Keep selectedSeatType valid when level changes
  useEffect(() => {
    if (!seatTypesAtLevel.includes(selectedSeatType) && seatTypesAtLevel.length > 0) {
      setSelectedSeatType(seatTypesAtLevel[0]);
    }
  }, [seatTypesAtLevel, selectedSeatType]);

  const availableRounds = useMemo(() => {
    return [...new Set(cutoffs.map((r) => r.round))].sort((a, b) => roundIndex(a) - roundIndex(b));
  }, [cutoffs]);

  const series = useMemo((): ChartSeries[] => {
    const rows = cutoffs.filter((r) => r.seatType === selectedSeatType);
    const byBranch = new Map<string, Map<number | string, number>>();
    for (const row of rows) {
      if (!byBranch.has(row.branch)) byBranch.set(row.branch, new Map());
      byBranch.get(row.branch)!.set(row.round, row.closingMerit);
    }
    return [...byBranch.entries()]
      .map(([branch, roundMap]) => {
        const roundValues = availableRounds.map((r) => roundMap.get(r) ?? null);
        const merits = roundValues.filter((v): v is number => v !== null);
        return {
          label: branch,
          roundValues,
          firstMerit: merits[0] ?? 0,
          lastMerit: merits.at(-1) ?? 0,
        };
      })
      .filter((s) => s.firstMerit > 0)
      .sort((a, b) => a.firstMerit - b.firstMerit);
  }, [cutoffs, selectedSeatType, availableRounds]);

  if (availableLevels.length === 0) return null;

  const hoveredSeries = hovered !== null ? series[hovered] ?? null : null;
  const levelLabel = selectedLevel === "all" ? "all levels" : (LEVEL_LABELS[selectedLevel] ?? selectedLevel);
  const catLabel = seatTypeShortLabel(selectedSeatType);

  return (
    <section className="cutoff-chart card" aria-label="Cutoff visualization">
      <div className="cc-header">
        <h2 className="cc-title">Closing rank by branch</h2>
        <p className="cc-desc">Last merit number admitted to each branch. Lower = harder to get.</p>
      </div>

      <div className="cc-filters">
        <div className="cc-filter-row">
          <label className="label" htmlFor="cc-level-select">University</label>
          <select
            id="cc-level-select"
            className="cc-select"
            value={selectedLevel}
            onChange={(e) => { setSelectedLevel(e.target.value); setHovered(null); }}
          >
            <option value="all">All levels</option>
            {availableLevels.map((l) => (
              <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
            ))}
          </select>
        </div>
        <div className="cc-filter-row">
          <label className="label" htmlFor="cc-seat-select">Category</label>
          <select
            id="cc-seat-select"
            className="cc-select"
            value={selectedSeatType}
            onChange={(e) => { setSelectedSeatType(e.target.value); setHovered(null); }}
          >
            {seatTypesAtLevel.map((st) => (
              <option key={st} value={st}>{seatTypeShortLabel(st)}</option>
            ))}
          </select>
        </div>
      </div>

      {series.length === 0 ? (
        <div className="cc-empty">No closing ranks for {catLabel} · {levelLabel}</div>
      ) : (
        <>
          <div className="cc-legend">
            <span className="cc-legend-item"><span className="cc-dot cc-dot-r1" aria-hidden="true" />{formatRound(1)}</span>
            <span className="cc-legend-item"><span className="cc-dot cc-dot-last" aria-hidden="true" />Latest round</span>
            <span className="cc-legend-hint">Hover a row, or open the table below, to see every round</span>
          </div>
          <div
            className="cc-chart-wrap"
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
          >
            <ChartSvg
              series={series}
              svgWidth={svgWidth}
              hoveredIdx={hovered}
              onRowEnter={setHovered}
              onRowLeave={() => setHovered(null)}
            />
            {hoveredSeries && (
              <ChartTooltip series={hoveredSeries} rounds={availableRounds} x={pos.x} y={pos.y} maxX={svgWidth} />
            )}
          </div>
          <SeriesTable
            series={series}
            rounds={availableRounds}
            rowHeader="Branch"
            sources={sourceNotes(cutoffs.filter((r) => r.seatType === selectedSeatType))}
          />
        </>
      )}
    </section>
  );
}

// ─── SeatCutoffChart — seat types for one branch, filtered by level ───────────

interface SeatCutoffChartProps {
  cutoffs: CutoffRow[];
  branch: string;
  selectedLevel: string;
}

export function SeatCutoffChart({ cutoffs, branch, selectedLevel }: SeatCutoffChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWidth = useContainerWidth(containerRef);
  const { hovered, setHovered, pos, onMouseMove, onMouseLeave } = useTooltip();

  const availableRounds = useMemo(() => {
    return [...new Set(cutoffs.map((r) => r.round))].sort((a, b) => roundIndex(a) - roundIndex(b));
  }, [cutoffs]);

  const series = useMemo((): ChartSeries[] => {
    const filtered = cutoffs.filter((r) => {
      if (r.branch !== branch) return false;
      // All India values are All India merit numbers: a different scale from state merit
      if (r.seatType === "AI" || r.list === "AI") return false;
      if (selectedLevel === "all") return true;
      return (seatLevelCode(r.seatType) ?? "S") === selectedLevel;
    });

    const byType = new Map<string, Map<number | string, number>>();
    for (const row of filtered) {
      if (!byType.has(row.seatType)) byType.set(row.seatType, new Map());
      byType.get(row.seatType)!.set(row.round, row.closingMerit);
    }

    return [...byType.entries()]
      .sort(([a], [b]) => seatTypeSortKey(a) - seatTypeSortKey(b))
      .map(([seatType, roundMap]) => {
        const roundValues = availableRounds.map((r) => roundMap.get(r) ?? null);
        const merits = roundValues.filter((v): v is number => v !== null);
        return {
          label: seatCategoryLabel(seatType),
          roundValues,
          firstMerit: merits[0] ?? 0,
          lastMerit: merits.at(-1) ?? 0,
        };
      })
      .filter((s) => s.firstMerit > 0);
  }, [cutoffs, branch, selectedLevel, availableRounds]);

  const hoveredSeries = hovered !== null ? series[hovered] ?? null : null;
  const levelDesc = selectedLevel === "all" ? "all levels" : (LEVEL_LABELS[selectedLevel] ?? selectedLevel);

  if (!branch) return null;

  return (
    <div className="seat-chart">
      {series.length === 0 ? (
        <div className="cc-empty">No closing ranks for this branch · {levelDesc}</div>
      ) : (
        <>
          <div className="cc-legend">
            <span className="cc-legend-item"><span className="cc-dot cc-dot-r1" aria-hidden="true" />{formatRound(1)}</span>
            <span className="cc-legend-item"><span className="cc-dot cc-dot-last" aria-hidden="true" />Latest round</span>
            <span className="cc-legend-hint">Hover a row, or open the table below, to see every round</span>
          </div>
          <div
            className="cc-chart-wrap"
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
          >
            <ChartSvg
              series={series}
              svgWidth={svgWidth}
              hoveredIdx={hovered}
              onRowEnter={setHovered}
              onRowLeave={() => setHovered(null)}
            />
            {hoveredSeries && (
              <ChartTooltip series={hoveredSeries} rounds={availableRounds} x={pos.x} y={pos.y} maxX={svgWidth} />
            )}
          </div>
          <SeriesTable
            series={series}
            rounds={availableRounds}
            rowHeader="Seat type"
            sources={sourceNotes(cutoffs.filter((r) => r.branch === branch && r.seatType !== "AI"))}
          />
          {cutoffs.some((r) => r.branch === branch && r.seatType === "AI") && (
            <p className="cc-note">All India seats use the All India merit number, so they aren't on this chart. Pick “All India” in the chart above.</p>
          )}
        </>
      )}
    </div>
  );
}
