import { useState, useMemo, useRef, useEffect, useCallback, type CSSProperties } from "react";
import "./CutoffChart.css";

interface CutoffRow {
  branch: string;
  seatType: string;
  round: number;
  closingMerit: number;
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

const DOT_COLOR = "#0f1b33";
const LOG_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 400000];

const LABEL_W = 172;
const RIGHT_PAD = 72;
const ROW_H = 36;
const ROW_GAP = 6;
const DOT_R1 = 8;
const DOT_LAST = 6;
const SVG_TOP = 8;
const SVG_BTM = 26;

interface TooltipData {
  label: string;
  seatType: string;
  allRounds: { round: number; merit: number }[];
  screenX: number;
  screenY: number;
}

interface CutoffChartProps {
  cutoffs: CutoffRow[];
  /**
   * "branch"   — rows = branches, dropdown = one category (default, CollegePage chart 1)
   * "category" — rows = categories, dropdown = one branch (CollegePage chart 2)
   */
  variant?: "branch" | "category";
}

export function CutoffChart({ cutoffs, variant = "branch" }: CutoffChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(640);

  const updateWidth = useCallback(() => {
    if (containerRef.current) setChartW(containerRef.current.clientWidth || 640);
  }, []);

  useEffect(() => {
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateWidth]);

  // branch → seatType → round → merit
  const dataMap = useMemo(() => {
    const m = new Map<string, Map<string, Map<number, number>>>();
    for (const row of cutoffs) {
      if (!m.has(row.branch)) m.set(row.branch, new Map());
      const stm = m.get(row.branch)!;
      if (!stm.has(row.seatType)) stm.set(row.seatType, new Map());
      stm.get(row.seatType)!.set(row.round, row.closingMerit);
    }
    return m;
  }, [cutoffs]);

  const availableRounds = useMemo(
    () => [...new Set(cutoffs.map((r) => r.round))].sort((a, b) => a - b),
    [cutoffs],
  );

  const allSeatTypes = useMemo(() => {
    const set = new Set(cutoffs.map((r) => r.seatType));
    return [
      ...PREFERRED_SEAT_TYPES.filter((st) => set.has(st)),
      ...[...set].filter((st) => !PREFERRED_SEAT_TYPES.includes(st)).sort(),
    ].slice(0, 12);
  }, [cutoffs]);

  const allBranches = useMemo(
    () => [...new Set(cutoffs.map((r) => r.branch))].sort(),
    [cutoffs],
  );

  // Single-select filter for each variant
  const [activeSeatType, setActiveSeatType] = useState<string>(() => allSeatTypes[0] ?? "");
  useEffect(() => {
    setActiveSeatType((prev) =>
      allSeatTypes.includes(prev) ? prev : (allSeatTypes[0] ?? ""),
    );
  }, [allSeatTypes]);

  const [activeBranch, setActiveBranch] = useState<string>(() => allBranches[0] ?? "");
  useEffect(() => {
    setActiveBranch((prev) =>
      allBranches.includes(prev) ? prev : (allBranches[0] ?? ""),
    );
  }, [allBranches]);

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Rows to render, sorted by R1 merit ascending
  const rows = useMemo(() => {
    const r1 = availableRounds[0];
    if (variant === "branch") {
      return [...dataMap.keys()]
        .filter((br) => dataMap.get(br)?.has(activeSeatType))
        .sort((a, b) => {
          const am = dataMap.get(a)?.get(activeSeatType)?.get(r1) ?? Infinity;
          const bm = dataMap.get(b)?.get(activeSeatType)?.get(r1) ?? Infinity;
          return am - bm;
        });
    } else {
      // category variant: rows = seat types for the selected branch
      const brData = dataMap.get(activeBranch);
      if (!brData) return [] as string[];
      return allSeatTypes
        .filter((st) => brData.has(st))
        .sort((a, b) => {
          const am = brData.get(a)?.get(r1) ?? Infinity;
          const bm = brData.get(b)?.get(r1) ?? Infinity;
          return am - bm;
        });
    }
  }, [dataMap, allSeatTypes, activeSeatType, activeBranch, availableRounds, variant]);

  const { logA, logZ, ticks } = useMemo(() => {
    const merits: number[] = [];
    const brData = variant === "category" ? dataMap.get(activeBranch) : null;
    for (const key of rows) {
      const d =
        variant === "branch"
          ? dataMap.get(key)?.get(activeSeatType)
          : brData?.get(key);
      if (d) merits.push(...d.values());
    }
    if (merits.length === 0) return { logA: 50, logZ: 400000, ticks: [] as number[] };
    const mn = Math.min(...merits);
    const mx = Math.max(...merits);
    const a = LOG_TICKS.filter((t) => t <= mn).at(-1) ?? LOG_TICKS[0];
    const z = LOG_TICKS.find((t) => t >= mx) ?? LOG_TICKS.at(-1)!;
    return { logA: a, logZ: z, ticks: LOG_TICKS.filter((t) => t >= a && t <= z) };
  }, [rows, activeSeatType, activeBranch, dataMap, variant]);

  const cw = Math.max(chartW - LABEL_W - RIGHT_PAD, 80);

  function xOf(v: number) {
    if (v <= 0 || logA >= logZ) return LABEL_W;
    return LABEL_W + ((Math.log(v) - Math.log(logA)) / (Math.log(logZ) - Math.log(logA))) * cw;
  }

  const svgH = SVG_TOP + rows.length * (ROW_H + ROW_GAP) + SVG_BTM;

  if (allSeatTypes.length === 0) return null;

  function renderDumbbellRow(
    bi: number,
    rowKey: string,
    rowLabel: string,
    stData: Map<number, number>,
    seatType: string,
  ) {
    const orderedRounds = availableRounds.filter((r) => stData.has(r));
    if (orderedRounds.length === 0) return null;

    const rowY = SVG_TOP + bi * (ROW_H + ROW_GAP) + ROW_H / 2;
    const r1 = orderedRounds[0];
    const rLast = orderedRounds[orderedRounds.length - 1];
    const m1 = stData.get(r1)!;
    const mLast = stData.get(rLast)!;
    const x1 = xOf(m1);
    const xLast = xOf(mLast);
    const allRounds = orderedRounds.map((r) => ({ round: r, merit: stData.get(r)! }));

    const handleHover = (e: React.MouseEvent) =>
      setTooltip({ label: rowLabel, seatType, allRounds, screenX: e.clientX, screenY: e.clientY });
    const handleMove = (e: React.MouseEvent) =>
      setTooltip((t) => (t ? { ...t, screenX: e.clientX, screenY: e.clientY } : null));
    const hov = {
      style: { cursor: "pointer" } as CSSProperties,
      onMouseEnter: handleHover,
      onMouseMove: handleMove,
    };

    return (
      <g key={rowKey}>
        <line
          x1={LABEL_W} y1={rowY + ROW_H / 2 + ROW_GAP / 2}
          x2={chartW - RIGHT_PAD / 2} y2={rowY + ROW_H / 2 + ROW_GAP / 2}
          stroke="#e3e6ec" strokeWidth={1}
        />
        <text x={LABEL_W - 10} y={rowY + 4} textAnchor="end" fontSize={11.5} fill="#0f1b33">
          {rowLabel.length > 26 ? rowLabel.slice(0, 25) + "…" : rowLabel}
        </text>
        {/* Invisible wider hover target */}
        <rect
          x={Math.min(x1, xLast) - DOT_R1} y={rowY - DOT_R1}
          width={Math.abs(xLast - x1) + DOT_R1 * 2} height={DOT_R1 * 2}
          fill="transparent" {...hov}
        />
        {orderedRounds.length > 1 && (
          <line
            x1={x1} y1={rowY} x2={xLast} y2={rowY}
            stroke={DOT_COLOR} strokeWidth={2.5} strokeOpacity={0.45}
            {...hov}
          />
        )}
        {/* Last round dot (smaller, behind) */}
        {orderedRounds.length > 1 && (
          <>
            <circle
              cx={xLast} cy={rowY} r={DOT_LAST}
              fill={DOT_COLOR} fillOpacity={0.6} stroke="white" strokeWidth={1.5}
              {...hov}
            />
            <text
              x={xLast + DOT_LAST + 4} y={rowY + 3.5}
              fontSize={9} fill={DOT_COLOR} fillOpacity={0.75}
              style={{ pointerEvents: "none" }}
            >
              {mLast.toLocaleString("en-IN")}
            </text>
          </>
        )}
        {/* Round 1 dot (larger, in front) */}
        <circle
          cx={x1} cy={rowY} r={DOT_R1}
          fill={DOT_COLOR} stroke="white" strokeWidth={2}
          {...hov}
        />
        <text
          x={x1 + DOT_R1 + 5} y={rowY + 3.5}
          fontSize={9.5} fontWeight={600} fill={DOT_COLOR}
          style={{ pointerEvents: "none" }}
        >
          {m1.toLocaleString("en-IN")}
        </text>
      </g>
    );
  }

  const filterLabel = variant === "branch" ? "CATEGORY" : "BRANCH";
  const filterValue = variant === "branch" ? activeSeatType : activeBranch;
  const filterOptions =
    variant === "branch"
      ? allSeatTypes.map((st) => ({ value: st, label: `${SEAT_NAMES[st] ?? st} (${st})` }))
      : allBranches.map((b) => ({ value: b, label: b }));
  const onFilterChange = variant === "branch"
    ? (v: string) => setActiveSeatType(v)
    : (v: string) => setActiveBranch(v);

  return (
    <section className="cc-root" ref={containerRef}>
      <div className="cc-cat-filter">
        <span className="cc-filter-label">{filterLabel}</span>
        <select
          className="cc-cat-select"
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="cc-empty">
          No data for the selected {variant === "branch" ? "category" : "branch"}.
        </div>
      ) : (
        <>
          <p className="cc-hint">
            Large dot = Round I · Small dot = Final round · Hover for all round details
          </p>
          <svg
            className="cc-svg"
            width={chartW}
            height={svgH}
            onMouseLeave={() => setTooltip(null)}
          >
            {ticks.map((t) => {
              const x = xOf(t);
              return (
                <g key={t}>
                  <line x1={x} y1={SVG_TOP} x2={x} y2={svgH - SVG_BTM} stroke="#e3e6ec" strokeWidth={1} />
                  <text x={x} y={svgH - 6} textAnchor="middle" fontSize={10} fill="#55607a">
                    {t >= 1000 ? `${t / 1000}k` : t}
                  </text>
                </g>
              );
            })}

            {variant === "branch" &&
              rows.map((br, bi) => {
                const stData = dataMap.get(br)?.get(activeSeatType);
                if (!stData) return null;
                return renderDumbbellRow(bi, br, br, stData, activeSeatType);
              })}

            {variant === "category" &&
              rows.map((st, bi) => {
                const stData = dataMap.get(activeBranch)?.get(st);
                if (!stData) return null;
                return renderDumbbellRow(bi, st, SEAT_NAMES[st] ?? st, stData, st);
              })}
          </svg>
        </>
      )}

      {tooltip && (
        <div
          className="cc-tooltip"
          style={{ left: tooltip.screenX + 14, top: tooltip.screenY - 12 } as CSSProperties}
          aria-hidden="true"
        >
          <div className="cc-tt-branch">{tooltip.label}</div>
          <div className="cc-tt-seat">
            <span className="cc-tt-swatch" style={{ background: DOT_COLOR }} />
            {SEAT_NAMES[tooltip.seatType] ?? tooltip.seatType}
          </div>
          <div className="cc-tt-rounds">
            {tooltip.allRounds.map(({ round, merit }) => {
              const maxV = Math.max(...tooltip.allRounds.map((x) => x.merit));
              const pct = Math.round((merit / maxV) * 100);
              return (
                <div key={round} className="cc-tt-row">
                  <span className="cc-tt-rlabel">R{round}</span>
                  <div className="cc-tt-bar-track">
                    <div className="cc-tt-bar-fill" style={{ width: `${pct}%`, background: DOT_COLOR }} />
                  </div>
                  <span className="cc-tt-rval">{merit.toLocaleString("en-IN")}</span>
                </div>
              );
            })}
          </div>
          <p className="cc-tt-note">Lower merit = more competitive</p>
        </div>
      )}
    </section>
  );
}
