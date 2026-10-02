import { useRef, useState, useEffect, useCallback, useMemo } from "react";

const LOG_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 400000];
const LANES = 3;
const LANE_H = 16;
const AXIS_H = 26;
const PAD = 14;

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bestBounds(vals: number[]): { a: number; z: number } {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const a = LOG_TICKS.filter((t) => t <= min).at(-1) ?? LOG_TICKS[0];
  const z = LOG_TICKS.find((t) => t >= max) ?? LOG_TICKS.at(-1)!;
  return { a, z };
}

function logX(v: number, a: number, z: number, W: number): number {
  return PAD + ((Math.log(v) - Math.log(a)) / (Math.log(z) - Math.log(a))) * (W - PAD * 2);
}

function logInvert(px: number, a: number, z: number, W: number): number {
  return Math.exp(Math.log(a) + ((px - PAD) / (W - PAD * 2)) * (Math.log(z) - Math.log(a)));
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export interface RulerBranch {
  label: string;
  r1Merit: number;
  lastMerit: number;
}

interface Props {
  branches: RulerBranch[];
  merit: number | null;
  onMeritChange: (merit: number) => void;
}

export function MeritRuler({ branches, merit, onMeritChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const svgData = useMemo(() => {
    if (branches.length === 0 || width < 60) return null;
    const W = width;
    const narrow = W < 500;
    const CHAR_W = narrow ? 5.4 : 6.1;
    const MAX_LBL = narrow ? 10 : 16;

    const allVals = branches.map((b) => b.lastMerit);
    if (merit) allVals.push(merit);
    const { a, z } = bestBounds(allVals);
    const x = (v: number) => logX(v, a, z, W);

    const TOP = LANES * LANE_H + 8;
    const BASE = TOP + AXIS_H;
    const CHIP_Y = BASE + LANES * LANE_H + 12;
    const H = CHIP_Y + 24;
    const pinX = merit != null ? x(merit) : null;

    // axis background: gray left of pin, blue tint right of pin
    const axisRect =
      pinX != null
        ? `<rect x="${PAD}" y="${TOP}" width="${Math.max(pinX - PAD, 0).toFixed(1)}" height="${AXIS_H}" rx="4" fill="#f1f5f9"/>` +
          `<rect x="${pinX.toFixed(1)}" y="${TOP}" width="${Math.max(W - PAD - pinX, 0).toFixed(1)}" height="${AXIS_H}" rx="4" fill="var(--tint)"/>`
        : `<rect x="${PAD}" y="${TOP}" width="${(W - PAD * 2).toFixed(1)}" height="${AXIS_H}" rx="4" fill="#f1f5f9"/>`;

    // label placement: lane algorithm (3 lanes above + 3 below axis)
    const ends: { up: number[]; dn: number[] } = {
      up: Array(LANES).fill(-1e9) as number[],
      dn: Array(LANES).fill(-1e9) as number[],
    };

    const sorted = [...branches].sort((p, q) => p.lastMerit - q.lastMerit);
    let tickLines = "";
    let labelsSvg = "";

    sorted.forEach((b, i) => {
      const tx = x(b.lastMerit);
      const reach = merit != null && merit <= b.lastMerit;
      const name = trunc(b.label, MAX_LBL);
      const display = `${name} ${fmt(b.lastMerit)}`;
      const w = display.length * CHAR_W;

      let side: "up" | "dn" = i % 2 ? "dn" : "up";
      let lane = ends[side].findIndex((e) => e < tx - w / 2 - 6);
      if (lane < 0) {
        side = side === "up" ? "dn" : "up";
        lane = ends[side].findIndex((e) => e < tx - w / 2 - 6);
      }
      if (lane < 0) lane = LANES - 1;
      ends[side][lane] = tx + w / 2;

      const ly =
        side === "up" ? TOP - 8 - lane * LANE_H : BASE + 16 + lane * LANE_H;
      const y1 = side === "up" ? ly + 4 : TOP;
      const y2 = side === "up" ? BASE : ly - 11;
      const anchor =
        tx - w / 2 < 0 ? "start" : tx + w / 2 > W ? "end" : "middle";
      const lx =
        anchor === "start"
          ? Math.max(tx - 4, 0)
          : anchor === "end"
          ? Math.min(tx + 4, W)
          : tx;

      tickLines += `<line x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="${y1}" y2="${y2}" stroke="${reach ? "var(--violet)" : "#cbd5e1"}" stroke-width="${reach ? 2 : 1.5}"/>`;
      labelsSvg +=
        `<text x="${lx.toFixed(1)}" y="${ly}" text-anchor="${anchor}" font-size="${narrow ? 10 : 11}" fill="${reach ? "var(--violet-deep)" : "var(--muted-2)"}" font-weight="${reach ? 600 : 400}" stroke="#fff" stroke-width="4" paint-order="stroke" stroke-linejoin="round">` +
        `${escXml(name)}<tspan dx="3" font-family="var(--font-mono)" font-variant-numeric="tabular-nums">${fmt(b.lastMerit)}</tspan></text>`;
    });

    // axis tick marks
    const axisTicks = LOG_TICKS.filter((t) => t >= a && t <= z)
      .map(
        (t) =>
          `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${BASE}" y2="${BASE + 5}" stroke="#94a3b8"/>` +
          `<text x="${x(t).toFixed(1)}" y="${BASE + 16}" text-anchor="middle" font-size="10" fill="var(--muted-2)" font-family="var(--font-mono)">${t >= 1000 ? t / 1000 + "k" : t}</text>`
      )
      .join("");

    // pin
    let pin = "";
    if (pinX != null && merit != null) {
      const chipText = `You ${fmt(merit)}`;
      const chipW = chipText.length * 6.2 + 16;
      pin =
        `<line x1="${pinX.toFixed(1)}" x2="${pinX.toFixed(1)}" y1="${TOP - 6}" y2="${BASE + 4}" stroke="var(--navy-deep)" stroke-width="2.5"/>` +
        `<line x1="${pinX.toFixed(1)}" x2="${pinX.toFixed(1)}" y1="${BASE + 4}" y2="${CHIP_Y}" stroke="var(--navy-deep)" stroke-width="1" stroke-dasharray="2 3"/>` +
        `<rect x="${(pinX - chipW / 2).toFixed(1)}" y="${CHIP_Y}" width="${chipW.toFixed(1)}" height="21" rx="10.5" fill="var(--navy-deep)"/>` +
        `<text x="${pinX.toFixed(1)}" y="${CHIP_Y + 14.5}" text-anchor="middle" font-size="11" fill="#fff" font-weight="600" font-family="var(--font-mono)">${escXml(chipText)}</text>` +
        `<circle cx="${pinX.toFixed(1)}" cy="${TOP - 8}" r="6" fill="#fff" stroke="var(--navy-deep)" stroke-width="2"/>`;
    }

    return {
      W,
      H,
      pinX,
      a,
      z,
      body: axisRect + tickLines + labelsSvg + axisTicks + pin,
    };
  }, [branches, merit, width]);

  const computeMerit = useCallback(
    (clientX: number, rect: DOMRect): number => {
      if (!svgData) return 1;
      const { a, z, W } = svgData;
      const scaleX = W / rect.width;
      const raw = logInvert((clientX - rect.left) * scaleX, a, z, W);
      const clamped = Math.max(1, Math.min(raw, z));
      const step = clamped < 1000 ? 5 : 10;
      return Math.max(1, Math.round(clamped / step) * step);
    },
    [svgData]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      onMeritChange(computeMerit(e.clientX, e.currentTarget.getBoundingClientRect()));
    },
    [computeMerit, onMeritChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      onMeritChange(computeMerit(e.clientX, e.currentTarget.getBoundingClientRect()));
    },
    [computeMerit, onMeritChange]
  );

  return (
    <div ref={wrapRef} className="cp-ruler">
      {svgData && width > 0 ? (
        <svg
          viewBox={`0 0 ${svgData.W} ${svgData.H}`}
          style={{ height: svgData.H, cursor: "crosshair", display: "block", width: "100%" }}
          role="img"
          aria-label="Merit ruler showing your rank against branch cutoffs"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <g dangerouslySetInnerHTML={{ __html: svgData.body }} />
        </svg>
      ) : (
        <div style={{ height: 120 }} />
      )}
      <div className="cp-ruler-hint">
        <span>← harder to get</span>
        <span>Click or drag the pin</span>
        <span>easier to get →</span>
      </div>
    </div>
  );
}
