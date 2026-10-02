import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api, type CollegeFees, type CollegeFeesUnavailable } from "../lib/api";
import { useCompare } from "../lib/CompareContext";
import { addToList, isInList } from "../lib/list";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { formatNumber, formatRound } from "../lib/format";
import { formatInr } from "../lib/plans";
import { LadderAxis, ladderDomain } from "../components/MeritLadder";
import { logBounds, logScale, ticksIn, tickLabel } from "../lib/logScale";
import { useWidth } from "../lib/useWidth";
import "./ComparePage.css";

/** One colour and one shape per column, so colour is never the only difference. */
const MARKS = [
  { color: "var(--violet)", shape: "circle" },
  { color: "var(--navy-deep)", shape: "square" },
  { color: "var(--orange-shadow)", shape: "diamond" },
] as const;

function Mark({ k, x, y, r = 6 }: { k: number; x: number; y: number; r?: number }) {
  const m = MARKS[k % MARKS.length];
  if (m.shape === "circle") return <circle cx={x} cy={y} r={r} fill={m.color} />;
  if (m.shape === "square") return <rect x={x - r + 1} y={y - r + 1} width={2 * r - 2} height={2 * r - 2} fill={m.color} />;
  return <rect x={x - r + 1.5} y={y - r + 1.5} width={2 * r - 3} height={2 * r - 3} fill={m.color} transform={`rotate(45 ${x} ${y})`} />;
}

function MarkKey({ k }: { k: number }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" className="compare-mark">
      <Mark k={k} x={6} y={6} r={5.5} />
    </svg>
  );
}

/**
 * Every branch the pinned colleges offer, one row each, with one mark per college at its
 * latest-round general open closing rank. Further left is harder; the dashed line is the student.
 */
function CompareBranchChart({ pinned, dataMap, merit }: { pinned: { code: string; name: string }[]; dataMap: Record<string, CollegeData | null>; merit: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const byBranch = new Map<string, (number | null)[]>();
  pinned.forEach((c, k) => {
    const data = dataMap[c.code];
    if (!data) return;
    for (const b of new Set(data.cutoffs.map((r) => r.branch))) {
      const vals = data.cutoffs.filter((r) => r.branch === b && r.seatType === "GOPENS").map((r) => r.closingMerit);
      if (!vals.length) continue;
      const row = byBranch.get(b) ?? pinned.map(() => null);
      row[k] = Math.max(...vals);
      byBranch.set(b, row);
    }
  });
  const rows = [...byBranch.entries()]
    .map(([branch, v]) => ({ branch, v, min: Math.min(...v.filter((x): x is number => x != null)) }))
    .sort((a, b) => a.min - b.min);
  if (rows.length === 0) return null;
  const W = width || 700, narrow = W < 520, LEFT = narrow ? 110 : 230, RIGHT = 20, ROW = 32, TOP = 6, BTM = 30;
  const H = TOP + rows.length * ROW + BTM;
  const dom = logBounds(rows.flatMap((r) => r.v.filter((x): x is number => x != null)).concat(merit || []));
  const x = logScale(dom, LEFT, W - LEFT - RIGHT);
  const max = narrow ? 14 : 32;
  return (
    <section className="card compare-branches" aria-labelledby="compare-branches-title">
      <h2 id="compare-branches-title">Branch by branch</h2>
      <p className="compare-overview-note">Latest-round closing rank, general open (state level). Each row is a branch; each mark is one college. Further left is harder.</p>
      <p className="compare-key">
        {pinned.map((c, k) => <span key={c.code}><MarkKey k={k} />{c.name.split(/[,(]/)[0]}</span>)}
        {merit ? <span><span className="ladder-key ladder-key--you" />Your merit</span> : null}
      </p>
      <div ref={ref} className="compare-branches-chart">
        {width > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label="Closing rank by branch for each college">
            {rows.map((r, i) => i % 2 === 0 && <rect key={r.branch} x={0} y={TOP + i * ROW} width={W} height={ROW} className="cb-alt" />)}
            {ticksIn(dom, narrow).map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={TOP} y2={H - BTM} className="cb-grid" />
                <text x={x(t)} y={H - BTM + 16} textAnchor="middle" className="cb-axis">{tickLabel(t)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const cy = TOP + i * ROW + ROW / 2;
              const xs = r.v.filter((v): v is number => v != null).map(x);
              const reach = merit > 0 && r.v.some((v) => v != null && merit <= v);
              return (
                <g key={r.branch}>
                  <title>{`${r.branch}: ${pinned.map((c, k) => `${c.name.split(/[,(]/)[0]} ${r.v[k] != null ? formatNumber(r.v[k]!) : "—"}`).join(", ")}`}</title>
                  <text x={LEFT - 12} y={cy + 4} textAnchor="end" className={reach ? "cb-label reach" : "cb-label"}>
                    {r.branch.length > max ? r.branch.slice(0, max - 1) + "…" : r.branch}
                  </text>
                  {xs.length > 1 && <line x1={Math.min(...xs)} x2={Math.max(...xs)} y1={cy} y2={cy} className="cb-span" />}
                  {r.v.map((v, k) => (v != null ? <Mark key={k} k={k} x={x(v)} y={cy} /> : null))}
                </g>
              );
            })}
            {merit > 0 && <line x1={x(merit)} x2={x(merit)} y1={TOP - 2} y2={H - BTM} className="cb-you" />}
          </svg>
        )}
      </div>
    </section>
  );
}

interface CutoffRow {
  choiceCode: string;
  branch: string;
  round: string;
  seatType: string;
  closingMerit: number;
}

interface CollegeData {
  college: { code: string; name: string };
  cutoffs: CutoffRow[];
}

const ROUNDS = ["I", "II", "III", "IV"] as const;
const fmt = formatNumber;
const CRUMBS = [{ label: "Colleges", to: "/colleges" }, { label: "Compare" }];

function gopensForBranch(cutoffs: CutoffRow[], branch: string, round: string): number | null {
  const row = cutoffs.find((r) => r.branch === branch && r.seatType === "GOPENS" && r.round === round);
  return row ? row.closingMerit : null;
}

export function ComparePage() {
  const { pinned, unpin } = useCompare();
  const { profile } = useProfile();
  const merit = profile.meritNumber ?? 0;

  const [dataMap, setDataMap] = useState<Record<string, CollegeData | null>>({});
  const [feesMap, setFeesMap] = useState<Record<string, CollegeFees | CollegeFeesUnavailable | null>>({});
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string>>({});

  useEffect(() => {
    for (const c of pinned) {
      if (dataMap[c.code] !== undefined) continue;
      Promise.all([
        api.collegeCutoffs(c.code).catch(() => null),
        api.collegeFees(c.code).catch(() => null),
      ]).then(([cutoffs, fees]) => {
        const data = cutoffs as CollegeData | null;
        setDataMap((prev) => ({ ...prev, [c.code]: data }));
        setFeesMap((prev) => ({ ...prev, [c.code]: fees }));
        if (data && !selectedBranches[c.code]) {
          const branches = [...new Set(data.cutoffs.map((r) => r.branch))].sort();
          if (branches[0]) {
            setSelectedBranches((prev) => ({ ...prev, [c.code]: branches[0] }));
          }
        }
      });
    }
  }, [pinned]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pinned.length === 0) {
    return (
      <div className="page compare-page">
        <PageHeader breadcrumb={CRUMBS} title="Compare colleges" />
        <div className="empty-state">
          <Icon name="pin" size={28} className="empty-state-icon" />
          <h2>Nothing to compare yet</h2>
          <p>Use <strong>Add to compare</strong> on up to 3 colleges, from the Colleges list or a college page, to see their closing ranks and fees side by side.</p>
          <Link to="/colleges" className="btn btn-primary">
            <Icon name="building" size={18} />
            Browse colleges
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page compare-page">
      <PageHeader
        breadcrumb={CRUMBS}
        title="Compare colleges"
        subtitle={`${pinned.length} of 3 colleges. Pick a branch in each column to compare general open closing ranks and fees.`}
        actions={
          pinned.length < 3 && (
            <Link to="/colleges" className="btn btn-secondary btn-sm">
              <Icon name="plus" size={16} />
              Add a college
            </Link>
          )
        }
      />

      <CompareOverview pinned={pinned} dataMap={dataMap} feesMap={feesMap} merit={merit} />
      <CompareBranchChart pinned={pinned} dataMap={dataMap} merit={merit} />

      <div className="compare-scroll table-scroll">
        <div className="compare-grid" style={{ gridTemplateColumns: `repeat(${pinned.length}, minmax(240px, 1fr))` }}>
          {pinned.map((c) => {
            const data = dataMap[c.code];
            const fees = feesMap[c.code];
            const branch = selectedBranches[c.code] ?? "";
            const branches = data ? [...new Set(data.cutoffs.map((r) => r.branch))].sort() : [];
            const feeData = fees?.available ? fees : null;
            const totalFee = feeData?.fees.totalAnnualFee ?? null;

            return (
              <div key={c.code} className="compare-col">
                <div className="compare-col-head">
                  <h2 className="compare-col-name">
                    <MarkKey k={pinned.indexOf(c)} />
                    <Link to={`/colleges/${c.code}`}>{c.name}</Link>
                  </h2>
                  <div className="compare-col-code">Code {c.code}</div>
                  <div className="compare-col-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => unpin(c.code)}>
                      <Icon name="close" size={14} />
                      Remove
                    </button>
                  </div>
                </div>

                {data === undefined && (
                  <div className="compare-loading" role="status">Loading…</div>
                )}

                {data === null && (
                  <div className="compare-error" role="alert">Couldn't load this college. Try again later.</div>
                )}

                {data && (
                  <>
                    <div className="compare-branch-row">
                      <label className="compare-branch-label" htmlFor={`cmp-branch-${c.code}`}>Branch</label>
                      <select
                        id={`cmp-branch-${c.code}`}
                        className="compare-branch-select"
                        value={branch}
                        onChange={(e) => setSelectedBranches((prev) => ({ ...prev, [c.code]: e.target.value }))}
                      >
                        {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div className="compare-section-title">Closing rank, general open</div>
                    <div className="compare-merit-rows">
                      {ROUNDS.map((r) => {
                        const m = gopensForBranch(data.cutoffs, branch, r);
                        const surplus = m !== null && merit > 0 ? m - merit : null;
                        return (
                          <div key={r} className={`compare-merit-row${r === "I" ? " r1" : ""}`}>
                            <span className="compare-round-label">{formatRound(r)}</span>
                            <span className="compare-merit-val">
                              {m !== null ? fmt(m) : <span className="compare-na">—</span>}
                            </span>
                            {surplus !== null && (
                              <span className={`compare-surplus${surplus >= 0 ? " pos" : " neg"}`}>
                                {surplus >= 0 ? `${fmt(surplus)} to spare` : `${fmt(-surplus)} short`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="compare-section-title">Fees per year</div>
                    {totalFee !== null ? (
                      <div className="compare-fee-row">
                        <span className="compare-fee-label">Total</span>
                        <span className="compare-fee-val">{formatInr(totalFee)}</span>
                      </div>
                    ) : (
                      <div className="compare-na-row">Fees not published yet</div>
                    )}

                    <AddCollegeBtn code={c.code} name={c.name} branch={branch} cutoffs={data.cutoffs} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="compare-footnote">
        Closing ranks for general open seats (state level) from official CET Cell CAP lists. A guide, not a guarantee.
      </div>
    </div>
  );
}

function AddCollegeBtn({ code, name, branch, cutoffs }: {
  code: string; name: string; branch: string; cutoffs: CutoffRow[];
}) {
  const r1 = cutoffs.find((r) => r.branch === branch && r.seatType === "GOPENS" && r.round === "I");
  const [saved, setSaved] = useState(() => r1 ? isInList(r1.choiceCode) : false);

  if (!r1) return null;
  const choiceCode = r1.choiceCode;

  function handleAdd() {
    if (saved) return;
    addToList({
      choiceCode,
      collegeCode: code,
      collegeName: name,
      branch,
      seatType: "GOPENS",
      closingMerit: r1!.closingMerit,
      year: 2026,
    });
    setSaved(true);
  }

  return (
    <button type="button" className={`btn btn-block btn-sm ${saved ? "btn-secondary" : "btn-primary"}`} onClick={handleAdd} disabled={saved}>
      <Icon name={saved ? "check" : "plus"} size={16} />
      {saved ? "In your option form" : "Add to option form"}
    </button>
  );
}

/** Journey J5 (#92): every pinned college on one scale, one dot per branch, your merit as a line. */
function CompareOverview({
  pinned,
  dataMap,
  feesMap,
  merit,
}: {
  pinned: { code: string; name: string }[];
  dataMap: Record<string, CollegeData | null>;
  feesMap: Record<string, CollegeFees | CollegeFeesUnavailable | null>;
  merit: number;
}) {
  const rows = pinned.map((c) => {
    const data = dataMap[c.code];
    const branches = data
      ? [...new Set(data.cutoffs.map((r) => r.branch))].map((b) => {
          const vals = data.cutoffs.filter((r) => r.branch === b && r.seatType === "GOPENS").map((r) => r.closingMerit);
          return { branch: b, last: vals.length ? Math.max(...vals) : null };
        }).filter((b): b is { branch: string; last: number } => b.last != null)
      : [];
    const reachable = merit ? branches.filter((b) => merit <= b.last).sort((a, b) => a.last - b.last) : [];
    const fee = feesMap[c.code];
    return { ...c, loaded: data !== undefined, branches, best: reachable[0] ?? null, reachable: reachable.length, fee: fee && fee.available ? fee.fees.totalAnnualFee : null };
  });
  const domain = ladderDomain(rows.flatMap((r) => r.branches.map((b) => b.last)).concat(merit ? [merit] : []));
  const pct = (v: number) => {
    const [lo, hi] = domain;
    return Math.max(0, Math.min(100, ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * 100));
  };

  return (
    <section className="card compare-overview" aria-labelledby="compare-overview-title">
      <div className="compare-overview-head">
        <h2 id="compare-overview-title">{merit ? `Your line across all ${rows.length}` : "All branches on one scale"}</h2>
        <span className="compare-overview-note">General open (state level), last round. Each dot is a branch.</span>
      </div>
      <ul className="compare-overview-rows">
        {rows.map((r) => (
          <li key={r.code}>
            <div className="compare-overview-name">
              <Link to={`/colleges/${r.code}`}>{r.name}</Link>
              <span>
                {!r.loaded ? "Loading…" : merit ? (r.best ? `Best for you: ${r.best.branch} (${formatNumber(r.best.last)})` : "No branch within reach") : `${r.branches.length} branches`}
                {r.fee != null && ` · ${formatInr(r.fee)} a year`}
              </span>
            </div>
            <span
              className="compare-dots"
              role="img"
              aria-label={`${r.name}: ${r.branches.length} branches${merit ? `, ${r.reachable} within reach of merit ${formatNumber(merit)}` : ""}`}
            >
              <span className="ladder-track" />
              {r.branches.map((b) => (
                <span
                  key={b.branch}
                  className={`compare-dot${merit && merit <= b.last ? " in" : ""}`}
                  style={{ left: `${pct(b.last)}%` }}
                  title={`${b.branch}: ${formatNumber(b.last)}`}
                />
              ))}
              {merit ? <span className="ladder-you" style={{ left: `${pct(merit)}%` }} /> : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="compare-overview-axis"><span /><LadderAxis domain={domain} /></div>
      <p className="compare-legend">
        <span className="compare-dot in static" /> within reach of your merit
        <span className="compare-dot static" /> needed a better merit
        {merit ? <><span className="ladder-key ladder-key--you" /> your merit</> : null}
        <span>· lower number = harder to get</span>
      </p>
    </section>
  );
}
