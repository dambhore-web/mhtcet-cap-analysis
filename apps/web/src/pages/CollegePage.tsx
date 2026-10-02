import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type CollegeFees, type CollegeFeesUnavailable, type CollegePlacement } from "../lib/api";
import { PlacementCard } from "../components/PlacementCard";
import { useProfile } from "../lib/ProfileContext";
import { useCompare } from "../lib/CompareContext";
import { CutoffChart, SeatCutoffChart } from "../components/CutoffChart";
import { MeritRuler } from "../components/MeritRuler";
import { seatLevelCode, seatTypeLabel, seatTypeShortLabel, seatTypeSortKey, LEVEL_LABELS } from "../lib/seatType";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { avatarTint, collegeInitials, formatNumber, formatRound, roundIndex } from "../lib/format";
import { formatInr } from "../lib/plans";
import { eligibleSeatTypes, type CandidateProfile } from "@mhtcet/core";
import { AddToFormButton } from "../components/AddToFormButton";
import { listItemFrom } from "../lib/list";
import { minorityOf } from "../lib/categories";
import "./CollegePage.css";

interface CutoffRow {
  choiceCode: string;
  branch: string;
  list: string;
  round: number | string;
  section: string;
  seatType: string;
  stage: string | null;
  closingMerit: number;
  closingPercentile: number | null;
  source?: string | null;
  sourcePage?: number | null;
}

interface CollegeData {
  college: { code: string; name: string; status?: string | null; homeUniversity?: string | null; district?: string | null; collegeType?: string | null; totalIntake?: number | null };
  year: number;
  cutoffs: CutoffRow[];
}

export function CollegePage() {
  const { code } = useParams<{ code: string }>();
  const { profile, setProfile } = useProfile();
  const { pin, unpin, isPinned: checkPinned, canPin } = useCompare();
  const [data, setData] = useState<CollegeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [seatLevel, setSeatLevel] = useState<string>("all");
  const [fees, setFees] = useState<CollegeFees | CollegeFeesUnavailable | null>(null);
  const [placement, setPlacement] = useState<CollegePlacement | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Local profile state for the on-page search form (pre-populated from global profile)
  const [localSeatType, setLocalSeatType] = useState<string>(() =>
    profile.category ? `G${profile.category}S` : "GOPENS"
  );
  const [localMerit, setLocalMerit] = useState<number | null>(() => profile.meritNumber);
  const [localMeritInput, setLocalMeritInput] = useState<string>(() =>
    profile.meritNumber ? String(profile.meritNumber) : ""
  );

  const drillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    Promise.all([
      api.collegeCutoffs(code),
      api.collegeFees(code).catch(() => null),
      api.collegePlacement(code).catch(() => null),
    ])
      .then(([d, f, p]) => {
        setData(d as CollegeData);
        const branches = [...new Set((d.cutoffs as CutoffRow[]).map((r) => r.branch))].sort();
        if (branches.length > 0) setSelectedBranch(branches[0]);
        setFees(f);
        setPlacement(p && p.available ? p : null);
      })
      .catch(() => setError("Could not load college data. Is the API running?"))
      .finally(() => setLoading(false));
  }, [code]);

  // Sync localSeatType when profile.category changes externally
  useEffect(() => {
    setLocalSeatType(profile.category ? `G${profile.category}S` : "GOPENS");
  }, [profile.category]);

  const branches = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.cutoffs.map((r) => r.branch))].sort();
  }, [data]);

  const availableSeatLevels = useMemo(() => {
    if (!data || !selectedBranch) return [];
    const set = new Set<string>();
    for (const r of data.cutoffs) {
      if (r.branch !== selectedBranch) continue;
      set.add(seatLevelCode(r.seatType) ?? "S");
    }
    return (["S", "H", "O"] as const).filter((l) => set.has(l));
  }, [data, selectedBranch]);

  // State-level seat types available for the hero category select
  const heroSeatTypeOptions = useMemo(() => {
    if (!data) return [];
    const re = /^(G|L)[A-Z0-9]+S$/;
    return [...new Set(
      data.cutoffs.map((r) => r.seatType).filter((t) => re.test(t) || t === "TFWS" || t === "EWS")
    )].sort((a, b) => seatTypeSortKey(a) - seatTypeSortKey(b));
  }, [data]);

  // Branch chips: branches sorted by R1 closing merit for the selected seat type
  const branchChips = useMemo(() => {
    if (!data) return [];
    return branches.map((b) => {
      const r1 = data.cutoffs.find((r) => r.branch === b && r.seatType === localSeatType && roundIndex(r.round) === 1);
      return { branch: b, r1Merit: r1?.closingMerit ?? null };
    }).sort((a, b) => (a.r1Merit ?? 999999) - (b.r1Merit ?? 999999));
  }, [data, branches, localSeatType]);

  // Headline: Round I closing ranks for the local seat type
  const headline = useMemo(() => {
    if (!data) return null;
    let r1 = data.cutoffs.filter((r) => r.seatType === localSeatType && roundIndex(r.round) === 1);
    const seatTypeUsed = r1.length > 0 ? localSeatType : "GOPENS";
    if (r1.length === 0) r1 = data.cutoffs.filter((r) => r.seatType === "GOPENS" && roundIndex(r.round) === 1);
    if (r1.length === 0) return null;
    const sorted = [...r1].sort((x, y) => x.closingMerit - y.closingMerit);
    const reachable = localMerit
      ? new Set(data.cutoffs.filter((r) => r.seatType === seatTypeUsed && localMerit <= r.closingMerit).map((r) => r.branch)).size
      : null;
    return {
      hardest: sorted[0],
      easiest: sorted[sorted.length - 1],
      branchCount: new Set(r1.map((r) => r.branch)).size,
      merit: localMerit,
      reachable,
      seatTypeUsed,
    };
  }, [data, localMerit, localSeatType]);

  // Seat types this student can apply for (packages/core eligibility rules — used for "add to form")
  const eligible = useMemo(() => {
    if (!data) return null;
    const candidate: CandidateProfile = {
      candidature: "MH",
      homeUniversity: profile.homeUniversity || null,
      category: profile.category === "OPEN" ? null : profile.category,
      gender: profile.gender,
      ews: profile.ews,
      tfws: profile.tfws,
      defence: profile.defence,
      pwd: profile.pwd,
      orphan: profile.orphan,
      minorityCommunity: profile.minorityCommunity,
      meritNumber: profile.meritNumber ?? 1,
      subjectGroup: profile.subjectGroup,
    };
    return new Set(eligibleSeatTypes(candidate, { homeUniversity: data.college.homeUniversity ?? null, minorityCommunity: minorityOf(data.college.status) }));
  }, [data, profile]);

  // Best seat type row for the selected branch (for "add to option form")
  const branchChoice = useMemo(() => {
    if (!data || !selectedBranch) return null;
    const rows = data.cutoffs.filter((r) => r.branch === selectedBranch && r.list !== "AI" && (!eligible || eligible.has(r.seatType)));
    if (rows.length === 0) return null;
    const bySeat = new Map<string, CutoffRow[]>();
    for (const r of rows) bySeat.set(r.seatType, [...(bySeat.get(r.seatType) ?? []), r]);
    const [seatType, seatRows] = [...bySeat.entries()].sort(
      ([, a], [, b]) => Math.max(...b.map((r) => r.closingMerit)) - Math.max(...a.map((r) => r.closingMerit)),
    )[0];
    const sorted = [...seatRows].sort((a, b) => roundIndex(a.round) - roundIndex(b.round));
    const first = sorted.find((r) => roundIndex(r.round) === 1)?.closingMerit ?? null;
    const last = sorted[sorted.length - 1].closingMerit;
    return listItemFrom({
      choiceCode: sorted[0].choiceCode,
      collegeCode: data.college.code,
      collegeName: data.college.name,
      branch: selectedBranch,
      seatType,
      closingMerit: last,
      year: data.year,
      firstRoundClosing: first,
      lastRoundClosing: last,
    });
  }, [data, selectedBranch, eligible]);

  // Branches for the merit ruler: latest round + R1 per branch for the selected seat type
  const rulerBranches = useMemo(() => {
    if (!data || !headline) return [];
    const seatTypeUsed = headline.seatTypeUsed;
    const byBranch = new Map<string, { r1: number | null; last: number; lastIdx: number }>();
    for (const r of data.cutoffs) {
      if (r.seatType !== seatTypeUsed) continue;
      const idx = roundIndex(r.round);
      const cur = byBranch.get(r.branch);
      if (!cur) {
        byBranch.set(r.branch, { r1: idx === 1 ? r.closingMerit : null, last: r.closingMerit, lastIdx: idx });
      } else {
        if (idx === 1) cur.r1 = r.closingMerit;
        if (idx > cur.lastIdx) { cur.last = r.closingMerit; cur.lastIdx = idx; }
      }
    }
    return [...byBranch.entries()]
      .map(([label, v]) => ({ label, r1Merit: v.r1 ?? v.last, lastMerit: v.last }))
      .sort((a, b) => a.lastMerit - b.lastMerit);
  }, [data, headline]);

  function handleRulerMeritChange(merit: number) {
    setLocalMerit(merit);
    setLocalMeritInput(String(merit));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const v = parseInt(localMeritInput.replace(/[^0-9]/g, ""), 10);
    const merit = v > 0 ? v : null;
    setLocalMerit(merit);
    if (merit) setProfile({ ...profile, meritNumber: merit });
  }

  function handleBranchSelect(branch: string) {
    setSelectedBranch(branch);
    setTimeout(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const crumbs = [{ label: "Colleges", to: "/colleges" }, { label: data?.college.name ?? "College" }];

  if (loading) {
    return (
      <div className="page college-page">
        <PageHeader title="Loading college…" breadcrumb={crumbs} />
        <div className="cp-skeleton card" aria-busy="true" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page college-page">
        <PageHeader title="College not found" breadcrumb={[{ label: "Colleges", to: "/colleges" }, { label: "Not found" }]} />
        <div className="empty-state">
          <p>{error || "We have no cutoff data for this college code."}</p>
          <Link to="/colleges" className="btn btn-secondary">
            <Icon name="back" size={16} />
            Back to colleges
          </Link>
        </div>
      </div>
    );
  }

  const pinned = code ? checkPinned(code) : false;

  return (
    <div className="page college-page">
      <PageHeader
        breadcrumb={crumbs}
        title={
          <span className="cp-title">
            <span className="cp-college-tile" style={{ background: avatarTint(data.college.code) }} aria-hidden="true">
              {collegeInitials(data.college.name, data.college.code)}
            </span>
            <span>{data.college.name}</span>
          </span>
        }
        subtitle={[
          `College code ${data.college.code}`,
          data.college.district,
          data.college.collegeType,
          `closing ranks from CAP ${data.year}`,
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href).catch(() => {});
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
            >
              <Icon name={linkCopied ? "check" : "share"} size={16} />
              {linkCopied ? "Link copied" : "Copy link"}
            </button>
            {code && (
              <button
                type="button"
                className={`btn btn-sm ${pinned ? "btn-primary" : "btn-secondary"}`}
                onClick={() => (pinned ? unpin(code) : pin({ code, name: data.college.name }))}
                disabled={!pinned && !canPin}
                aria-pressed={pinned}
                title={!pinned && !canPin ? "You can compare up to 3 colleges" : undefined}
              >
                <Icon name={pinned ? "check" : "pin"} size={16} />
                {pinned ? "Added to compare" : "Add to compare"}
              </button>
            )}
          </>
        }
      />

      <div className="cp-layout">

        {/* ── HERO: full-width merit ruler ── */}
        <section className="cp-hero">
          <div className="cp-ruler-card">
            <form className="cp-controls" onSubmit={handleSearch}>
              <label className="cp-field">
                <span>Your state merit number</span>
                <input
                  className="cp-merit-in"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={localMeritInput}
                  onChange={(e) => {
                    setLocalMeritInput(e.target.value);
                    const v = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                    if (v > 0) setLocalMerit(v);
                  }}
                  placeholder="e.g. 10000"
                />
              </label>
              <div className="cp-row2">
                <label className="cp-field">
                  <span>Category</span>
                  <select
                    value={localSeatType}
                    onChange={(e) => setLocalSeatType(e.target.value)}
                  >
                    {heroSeatTypeOptions.map((st) => (
                      <option key={st} value={st}>{seatTypeShortLabel(st)}</option>
                    ))}
                  </select>
                </label>
                <label className="cp-field">
                  <span>University</span>
                  <select value={seatLevel} onChange={(e) => setSeatLevel(e.target.value)}>
                    <option value="all">All levels</option>
                    {availableSeatLevels.map((l) => (
                      <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                    ))}
                  </select>
                </label>
              </div>
            </form>

            <div className="cp-ruler-right">
              {localMerit && headline && headline.reachable !== null ? (
                <>
                  <p className="cp-verdict" aria-live="polite">
                    At <span className="cp-verdict-num">{formatNumber(localMerit)}</span>,{" "}
                    <b>{headline.reachable} of {headline.branchCount}</b> branches here were within reach.
                  </p>
                  <p className="cp-verdict-sub">
                    Latest CAP {data.year},{" "}
                    {seatTypeLabel(headline.seatTypeUsed).replace(/^General /i, "").toLowerCase()} seats.
                    {headline.reachable > 0 && (
                      <> Hardest within reach: {headline.hardest.branch} ({formatNumber(headline.hardest.closingMerit)}).</>
                    )}
                  </p>
                </>
              ) : (
                <p className="cp-verdict-empty">
                  Enter your merit number to see which branches here are within reach.
                </p>
              )}
              <MeritRuler
                branches={rulerBranches}
                merit={localMerit}
                onMeritChange={handleRulerMeritChange}
              />
            </div>
          </div>
        </section>

        {/* ── LEFT: charts ── */}
        <div className="cp-col">

          <CutoffChart
            cutoffs={data.cutoffs}
            collegeCode={data.college.code}
            controlledSeatType={localSeatType}
          />

          {/* Drill into a branch */}
          <section ref={drillRef} id="cp-drill" className="card cp-drill" aria-labelledby="cp-drill-title">
            <div className="card-head">
              <div>
                <h2 id="cp-drill-title">One branch, every seat type</h2>
                <p className="desc">Closing ranks for OBC, ladies, TFWS and the rest, in the branch you pick.</p>
              </div>
            </div>

            <div className="cp-chips" role="group" aria-label="Branch">
              {branchChips.map(({ branch, r1Merit }) => {
                const reach = localMerit != null && r1Merit != null && localMerit <= r1Merit;
                return (
                  <button
                    key={branch}
                    type="button"
                    className={`cp-chip${reach ? " reach" : ""}`}
                    aria-pressed={selectedBranch === branch}
                    onClick={() => setSelectedBranch(branch)}
                  >
                    {branch}
                    {r1Merit != null && (
                      <span className="cp-chip-rk">{formatNumber(r1Merit)}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {branchChoice && (
              <div className="cp-add">
                <span>
                  Choice code <strong className="cp-code">{branchChoice.choiceCode}</strong> · {selectedBranch}
                </span>
                <span className="cp-add-actions">
                  <Link to={`/colleges/${data.college.code}/${branchChoice.choiceCode}`} className="btn btn-ghost btn-sm">Branch trends</Link>
                  <AddToFormButton item={branchChoice} variant="button" />
                </span>
              </div>
            )}

            <div className="cp-branch-picker">
              <div className="cc-filter-row">
                <label className="label" htmlFor="cp-level-select">University</label>
                <select
                  id="cp-level-select"
                  className="cc-select"
                  value={seatLevel}
                  onChange={(e) => setSeatLevel(e.target.value)}
                >
                  <option value="all">All levels</option>
                  {availableSeatLevels.map((l) => (
                    <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                  ))}
                </select>
              </div>
            </div>

            <SeatCutoffChart cutoffs={data.cutoffs} branch={selectedBranch} selectedLevel={seatLevel} />
          </section>

          <p className="cp-footnote">
            Closing ranks from official CET Cell CAP {data.year} allotment lists. Past cutoffs are a guide, not a guarantee.{" "}
            <Link to="/legal">Disclaimer</Link>
          </p>
        </div>

        {/* ── RIGHT: sidebar ── */}
        <aside className="cp-side">

          {/* At a glance */}
          <section className="card cp-glance-card" aria-label="At a glance">
            <div className="card-head"><h2>At a glance</h2></div>
            <dl className="cp-kv">
              <div><dt>Branches in CAP</dt><dd className="big">{branches.length}</dd></div>
              {data.college.totalIntake ? <div><dt>Total intake</dt><dd className="big">{formatNumber(data.college.totalIntake)}</dd></div> : null}
              <div><dt>Home university</dt><dd>{data.college.homeUniversity ?? "None (state level only)"}</dd></div>
              {data.college.district ? <div><dt>District</dt><dd>{data.college.district}</dd></div> : null}
            </dl>
          </section>

          {/* Fees — standalone details card */}
          {fees && fees.available && (
            <details className="card cp-fees-card">
              <summary>
                <div className="card-head"><h2>Fees per year</h2></div>
                <div className="cp-fees-total-row">
                  <span className="cp-fees-num">{formatInr(fees.fees.totalAnnualFee)}</span>
                  {!fees.verified && <span className="badge badge-sample">Unverified</span>}
                </div>
                <span className="cp-more">
                  <span className="cp-more-o">Show breakdown ↓</span>
                  <span className="cp-more-c">Hide breakdown ↑</span>
                </span>
              </summary>
              <dl className="cp-fees-grid">
                {fees.fees.tuitionFee !== null && <div><dt>Tuition</dt><dd>{formatInr(fees.fees.tuitionFee)}</dd></div>}
                {fees.fees.developmentFee !== null && <div><dt>Development</dt><dd>{formatInr(fees.fees.developmentFee)}</dd></div>}
                {fees.fees.otherFees !== null && <div><dt>Other</dt><dd>{formatInr(fees.fees.otherFees)}</dd></div>}
              </dl>
              {fees.tfwsAvailable && (
                <p className="cp-fees-tfws">
                  <Icon name="tag" size={14} />
                  TFWS:{" "}
                  {fees.tfwsSeats != null
                    ? `${fees.tfwsSeats} seat${fees.tfwsSeats === 1 ? "" : "s"}${fees.tfwsBranches ? ` across ${fees.tfwsBranches} branch${fees.tfwsBranches === 1 ? "" : "es"}` : ""}`
                    : "seats available"}
                  . Parents earning under ₹8L/yr pay no tuition fee.
                </p>
              )}
              <p className="cp-fees-note">
                {fees.verified ? (
                  <>
                    As approved by the Fee Regulating Authority
                    {fees.fraOrderUrl ? (
                      <> (<a href={fees.fraOrderUrl} target="_blank" rel="noreferrer">FRA order{fees.fraOrderRef ? ` ${fees.fraOrderRef}` : ""}</a>)</>
                    ) : null}
                    . Confirm with the college before paying.
                  </>
                ) : (
                  <>Not yet checked against the FRA order. Confirm with the college before paying.</>
                )}
              </p>
            </details>
          )}

          {placement && <PlacementCard data={placement} />}
        </aside>
      </div>
    </div>
  );
}
