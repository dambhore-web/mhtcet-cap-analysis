import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatNumber } from "../lib/format";
import { logBounds, logScale, meritStep, roundMerit, tickLabel, ticksIn } from "../lib/logScale";
import "./MeritRuler.css";

/** One mark on the ruler. Labelled marks get stacked text; unlabelled ones draw as a barcode. */
export interface RulerMark {
  value: number;
  label?: string;
}

/** The college page's shape: a branch with its Round I and latest-round closing ranks. */
export interface RulerBranch {
  label: string;
  r1Merit: number;
  lastMerit: number;
}

interface Props {
  marks?: RulerMark[];
  /** Shorthand for labelled marks at each branch's latest-round closing rank. */
  branches?: RulerBranch[];
  merit: number | null;
  onMeritChange: (merit: number) => void;
  /** Draw every mark as a thin line (for hundreds of marks) instead of labelled ticks. */
  barcode?: boolean;
  domain?: [number, number];
  ariaLabel?: string;
  /** Middle hint under the ruler; null hides the hint row. */
  hint?: string | null;
  /**
   * Labels a merit number in the figure shown, e.g. as a percentile (the Find page's percentile
   * view). The ruler itself stays on merit numbers; only the text changes.
   */
  format?: (merit: number) => string;
  /** What the pin stands for, for screen readers. */
  pinLabel?: string;
}

const PAD = 14;
const LANE_H = 16;
const LANES = 3;

function trunc(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * The merit ruler: closing ranks on a log scale with a pin for the student. Everything right of
 * the pin took someone with that merit or worse, so it turns blue. Drag the pin, click the
 * ruler, or focus the pin and use the arrow keys (Shift for bigger steps).
 */
export function MeritRuler({
  marks, branches, merit, onMeritChange, barcode = false, domain, ariaLabel, hint = "Drag the pin, or type your merit number",
  format, pinLabel = "Your merit number",
}: Props) {
  const fmt = format ?? formatNumber;
  const tickText = format ?? tickLabel;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => el.clientWidth > 0 && setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allMarks = useMemo<RulerMark[]>(
    () => marks ?? (branches ?? []).map((b) => ({ value: b.lastMerit, label: b.label })),
    [marks, branches],
  );

  const g = useMemo(() => {
    if (width < 60 || allMarks.length === 0) return null;
    const W = width;
    const narrow = W < 500;
    const dom = domain ?? logBounds(allMarks.map((m) => m.value).concat(merit ?? []));
    const x = logScale(dom, PAD, W - PAD * 2);
    const labelled = allMarks.filter((m) => m.label).sort((p, q) => p.value - q.value);
    const lanes = labelled.length ? LANES : 0;
    const top = lanes * LANE_H + 8;
    const band = barcode ? 46 : 26;
    const base = top + band;
    const chipY = base + (labelled.length ? lanes * LANE_H + 12 : 22);
    const H = chipY + 24;

    // labels alternate above and below; on overlap they move to the next lane or the other side
    const ends = { up: Array<number>(lanes).fill(-1e9), dn: Array<number>(lanes).fill(-1e9) };
    const charW = narrow ? 5.6 : 6.4;
    const maxLabel = narrow ? 11 : 18;
    const placed = labelled.map((m, i) => {
      const name = trunc(m.label!, maxLabel);
      const tx = x(m.value);
      const w = `${name} ${fmt(m.value)}`.length * charW;
      let side: "up" | "dn" = i % 2 ? "dn" : "up";
      let lane = ends[side].findIndex((e) => e < tx - w / 2 - 6);
      if (lane < 0) {
        side = side === "up" ? "dn" : "up";
        lane = ends[side].findIndex((e) => e < tx - w / 2 - 6);
      }
      // No free lane on either side (crowded rulers on phones): keep the tick, drop the label rather
      // than print it over another one. The value is still in the tick's tooltip and the charts.
      const hidden = lane < 0;
      if (hidden) lane = 0;
      else ends[side][lane] = tx + w / 2;
      const ly = side === "up" ? top - 8 - lane * LANE_H : base + 16 + lane * LANE_H;
      const anchor: "start" | "middle" | "end" = tx - w / 2 < 0 ? "start" : tx + w / 2 > W ? "end" : "middle";
      const lx = anchor === "start" ? Math.max(tx - 4, 0) : anchor === "end" ? Math.min(tx + 4, W) : tx;
      return { m, name, tx, side, ly, anchor, lx, full: m.label!, hidden };
    });
    return { W, H, x, dom, top, base, band, chipY, narrow, placed, ticks: ticksIn(dom, narrow) };
  }, [width, allMarks, merit, domain, barcode, fmt]);

  const toMerit = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || !g) return null;
      const r = svg.getBoundingClientRect();
      const px = Math.min(Math.max((clientX - r.left) * (g.W / r.width), PAD), g.W - PAD);
      return roundMerit(g.x.invert(px));
    },
    [g],
  );

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = toMerit(e.clientX);
    if (v != null) onMeritChange(v);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const v = toMerit(e.clientX);
    if (v != null && v !== merit) onMeritChange(v);
  };
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (merit == null) return;
    const step = meritStep(merit, e.shiftKey);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onMeritChange(Math.max(1, merit - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onMeritChange(merit + step);
    }
  };

  const pinX = g && merit != null ? g.x(merit) : null;
  const chipText = merit != null ? `You ${fmt(merit)}` : "";
  const chipW = 16 + chipText.length * 6.7;

  return (
    <div ref={wrapRef} className="merit-ruler">
      {g ? (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${g.W} ${g.H}`}
          style={{ height: g.H }}
          role="img"
          aria-label={ariaLabel ?? "Closing ranks on a ruler, with your merit number"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          {pinX != null ? (
            <>
              <rect x={PAD} y={g.top} width={Math.max(pinX - PAD, 0)} height={g.band} rx={4} className="mr-out" />
              <rect x={pinX} y={g.top} width={Math.max(g.W - PAD - pinX, 0)} height={g.band} rx={4} className="mr-in" />
            </>
          ) : (
            <rect x={PAD} y={g.top} width={g.W - PAD * 2} height={g.band} rx={4} className="mr-out" />
          )}

          {barcode &&
            allMarks.filter((m) => !m.label).map((m, i) => {
              const reach = merit != null && merit <= m.value;
              const mx = g.x(m.value).toFixed(1);
              return <line key={i} x1={mx} x2={mx} y1={g.top + 3} y2={g.base - 3} className={reach ? "mr-bar reach" : "mr-bar"} />;
            })}

          {g.placed.map((p, i) => {
            const reach = merit != null && merit <= p.m.value;
            return (
              <line
                key={i}
                x1={p.tx}
                x2={p.tx}
                y1={p.hidden ? g.top + 2 : p.side === "up" ? p.ly + 4 : g.top}
                y2={p.hidden ? g.base - 2 : p.side === "up" ? g.base : p.ly - 11}
                className={reach ? "mr-tick reach" : "mr-tick"}
              >
                <title>{`${p.full}: ${fmt(p.m.value)}`}</title>
              </line>
            );
          })}

          {g.ticks.map((t) => (
            <g key={t}>
              <line x1={g.x(t)} x2={g.x(t)} y1={g.base} y2={g.base + 5} className="mr-axis" />
              {g.placed.length === 0 && (
                <text x={g.x(t)} y={g.base + 17} textAnchor="middle" className="mr-axis-label">{tickText(t)}</text>
              )}
            </g>
          ))}

          {pinX != null && merit != null && (
            <g
              className="mr-handle"
              tabIndex={0}
              role="slider"
              aria-label={pinLabel}
              aria-valuemin={g.dom[0]}
              aria-valuemax={g.dom[1]}
              aria-valuenow={merit}
              aria-valuetext={fmt(merit)}
              onKeyDown={onKeyDown}
            >
              <rect x={pinX - 16} y={0} width={32} height={g.H} fill="transparent" />
              <line x1={pinX} x2={pinX} y1={g.placed.length ? 10 : g.top - 6} y2={g.base + 4} className="mr-pin" />
              <line x1={pinX} x2={pinX} y1={g.base + 4} y2={g.chipY} className="mr-pin-thin" />
              <rect x={Math.min(Math.max(pinX - chipW / 2, 0), g.W - chipW)} y={g.chipY} width={chipW} height={21} rx={10.5} className="mr-chip" />
              <text x={Math.min(Math.max(pinX, chipW / 2), g.W - chipW / 2)} y={g.chipY + 14.5} textAnchor="middle" className="mr-chip-text">{chipText}</text>
              <circle cx={pinX} cy={g.placed.length ? 6 : g.top - 8} r={6} className="mr-head" />
            </g>
          )}

          <g pointerEvents="none">
            {g.placed.map((p, i) => {
              if (p.hidden) return null;
              const reach = merit != null && merit <= p.m.value;
              return (
                <text key={i} x={p.lx} y={p.ly} textAnchor={p.anchor} className={reach ? "mr-label reach" : "mr-label"}>
                  <title>{`${p.full}: ${fmt(p.m.value)}`}</title>
                  {p.name}
                  <tspan dx={3} className="mr-label-num">{fmt(p.m.value)}</tspan>
                </text>
              );
            })}
          </g>
        </svg>
      ) : (
        <div style={{ height: 120 }} />
      )}
      {hint !== null && (
        <div className="mr-hint">
          <span>← harder to get</span>
          <span className="mr-hint-mid">{hint}</span>
          <span>easier to get →</span>
        </div>
      )}
    </div>
  );
}
