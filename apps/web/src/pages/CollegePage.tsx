import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type CollegeFees, type CollegeFeesUnavailable, type CollegePlacement } from "../lib/api";
import { PlacementCard } from "../components/PlacementCard";
import { useProfile } from "../lib/ProfileContext";
import { useCompare } from "../lib/CompareContext";
import { CutoffChart, SeatCutoffChart } from "../components/CutoffChart";
import { seatLevelCode, LEVEL_LABELS } from "../lib/seatType";
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

type BranchStatus = "round-I" | "later" | "out";

function getBranchStatus(cutoffs: CutoffRow[], branch: string, merit: number): BranchStatus {
  const rows = cutoffs.filter((r) => r.branch === branch && r.seatType === "GOPENS");
  if (rows.length === 0) return "out";
  const r1 = rows.find((r) => roundIndex(r.round) === 1);
  if (r1 && merit <= r1.closingMerit) return "round-I";
  if (rows.some((r) => merit <= r.closingMerit)) return "later";
  return "out";
}

export function CollegePage() {
  const { code } = useParams<{ code: string }>();
  const { profile } = useProfile();
  const { pin, unpin, isPinned: checkPinned, canPin } = useCompare();
  const [data, setData] = useState<CollegeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [seatLevel, setSeatLevel] = useState<string>("all");
  const [whatifMerit, setWhatifMerit] = useState<number>(() => profile.meritNumber ?? 10000);
  const [showWhatif, setShowWhatif] = useState(false);
  const [fees, setFees] = useState<CollegeFees | CollegeFeesUnavailable | null>(null);
  const [placement, setPlacement] = useState<CollegePlacement | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

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

  // Round I closing rank for general open (state level) seats: the student-facing headline
  const headline = useMemo(() => {
    if (!data) return null;
    const r1 = data.cutoffs.filter((r) => r.seatType === "GOPENS" && roundIndex(r.round) === 1);
    if (r1.length === 0) return null;
    const sorted = [...r1].sort((x, y) => x.closingMerit - y.closingMerit);
    const merit = profile.meritNumber;
    const reachable = merit
      ? new Set(data.cutoffs.filter((r) => r.seatType === "GOPENS" && merit <= r.closingMerit).map((r) => r.branch)).size
      : null;
    return {
      hardest: sorted[0],
      easiest: sorted[sorted.length - 1],
      branchCount: new Set(r1.map((r) => r.branch)).size,
      merit,
      reachable,
    };
  }, [data, profile.meritNumber]);

  const sliderMax = useMemo(() => {
    if (!data) return 140000;
    const max = Math.max(...data.cutoffs.map((r) => r.closingMerit));
    return Math.ceil((max + 5000) / 1000) * 1000;
  }, [data]);

  // Seat types this student can apply for at this college (packages/core eligibility rules)
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

  // The row the "add to option form" button uses: the student's best seat type for the branch
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

      <div className="cp-summary">
        {headline && (
          <section className="cp-headline card" aria-labelledby="cp-headline-title">
            <h2 id="cp-headline-title" className="label">Your chances here</h2>
            {headline.merit && headline.reachable !== null ? (
              <p className="cp-headline-main">
                With merit <strong>{formatNumber(headline.merit)}</strong>, you were within last year's general open cutoff for{" "}
                <strong>{headline.reachable} of {headline.branchCount}</strong> branches.
              </p>
            ) : (
              <p className="cp-headline-main">
                <Link to="/">Enter your merit number</Link> to see which branches here are within reach.
              </p>
            )}
            <dl className="cp-headline-stats">
              <div>
                <dt>Hardest branch</dt>
                <dd>
                  <span className="cp-stat-num">{formatNumber(headline.hardest.closingMerit)}</span>
                  <span className="cp-stat-sub">{headline.hardest.branch}</span>
                </dd>
              </div>
              <div>
                <dt>Easiest branch</dt>
                <dd>
                  <span className="cp-stat-num">{formatNumber(headline.easiest.closingMerit)}</span>
                  <span className="cp-stat-sub">{headline.easiest.branch}</span>
                </dd>
              </div>
            </dl>
            <p className="cp-headline-note">{formatRound(1)} closing ranks, general open seats (state level).</p>
          </section>
        )}

        {fees && fees.available && (
          <section className="cp-fees card" aria-labelledby="cp-fees-title">
            <h2 id="cp-fees-title" className="label">Fees per year ({fees.year})</h2>
            <p className="cp-fees-total">{formatInr(fees.fees.totalAnnualFee)}</p>
            <dl className="cp-fees-grid">
              {fees.fees.tuitionFee !== null && <div><dt>Tuition</dt><dd>{formatInr(fees.fees.tuitionFee)}</dd></div>}
              {fees.fees.developmentFee !== null && <div><dt>Development</dt><dd>{formatInr(fees.fees.developmentFee)}</dd></div>}
              {fees.fees.otherFees !== null && <div><dt>Other</dt><dd>{formatInr(fees.fees.otherFees)}</dd></div>}
            </dl>
            {fees.tfwsAvailable && (
              <p className="cp-fees-tfws">
                <Icon name="tag" size={14} />
                Tuition fee waiver (TFWS):{" "}
                {fees.tfwsSeats != null
                  ? `${fees.tfwsSeats} seat${fees.tfwsSeats === 1 ? "" : "s"}${fees.tfwsBranches ? ` across ${fees.tfwsBranches} branch${fees.tfwsBranches === 1 ? "" : "es"}` : ""}`
                  : "seats available"}
                . Maharashtra candidates whose parents earn less than ₹8 lakh a year pay no tuition fee; other fees still apply.
              </p>
            )}
            <p className="cp-fees-note">
              {fees.verified ? (
                <>
                  As approved by the Fee Regulating Authority
                  {fees.fraOrderUrl ? (
                    <>
                      {" "}(<a href={fees.fraOrderUrl} target="_blank" rel="noreferrer">FRA order{fees.fraOrderRef ? ` ${fees.fraOrderRef}` : ""}</a>)
                    </>
                  ) : null}
                  . Confirm with the college before paying.
                </>
              ) : (
                <>
                  <span className="badge badge-sample">Unverified</span> Not yet checked against the Fee Regulating Authority's order. Confirm with the college before paying.
                </>
              )}
            </p>
          </section>
        )}
      </div>

      <section className="page-section cp-glance card" aria-label="At a glance">
        <dl>
          <div><dt>Branches in CAP</dt><dd>{branches.length}</dd></div>
          {data.college.totalIntake ? <div><dt>Total intake</dt><dd>{formatNumber(data.college.totalIntake)}</dd></div> : null}
          <div><dt>Home university</dt><dd>{data.college.homeUniversity ?? "None (state level only)"}</dd></div>
          {data.college.district ? <div><dt>District</dt><dd>{data.college.district}</dd></div> : null}
        </dl>
      </section>

      {placement && <PlacementCard data={placement} />}

      <div className="page-section">
        <CutoffChart cutoffs={data.cutoffs} collegeCode={data.college.code} />
      </div>

      <section className="page-section card cp-detail" aria-labelledby="cp-detail-title">
        <div className="cp-detail-head">
          <div>
            <h2 id="cp-detail-title">Every seat type, one branch</h2>
            <p>Pick a branch to see the closing rank for each seat type in each CAP round.</p>
          </div>
          <button
            type="button"
            className={`btn btn-sm ${showWhatif ? "btn-primary" : "btn-secondary"}`}
            aria-expanded={showWhatif}
            onClick={() => setShowWhatif((v) => !v)}
          >
            <Icon name="sparkle" size={16} />
            Try a different merit number
          </button>
        </div>

        {showWhatif && (
          <div className="cp-whatif">
            <label className="cp-slider-row">
              <span className="label">Merit</span>
              <input
                type="range"
                min={1}
                max={sliderMax}
                step={50}
                value={whatifMerit}
                onChange={(e) => setWhatifMerit(parseInt(e.target.value, 10))}
                className="cp-slider"
              />
              <span className="cp-slider-val">{formatNumber(whatifMerit)}</span>
            </label>
            <div className="cp-whatif-legend">
              <span className="badge badge-safe"><Icon name="check" size={12} />{formatRound(1)}</span>
              <span className="badge badge-later"><Icon name="clock" size={12} />Later round</span>
              <span className="badge badge-out"><Icon name="minus" size={12} />Out of reach</span>
              <span className="cp-whatif-hint">General open seats, colour shown on each branch</span>
            </div>
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
          <div className="cc-filter-row">
            <label className="label" htmlFor="cp-branch-select">Branch</label>
            <select
              id="cp-branch-select"
              className="cc-select cc-select-branch"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              {branches.map((b) => {
                const st = showWhatif ? getBranchStatus(data.cutoffs, b, whatifMerit) : null;
                const tag = st === "round-I" ? ` — ${formatRound(1)}` : st === "later" ? " — later round" : st === "out" ? " — out of reach" : "";
                return <option key={b} value={b}>{b}{tag}</option>;
              })}
            </select>
          </div>
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

        <SeatCutoffChart cutoffs={data.cutoffs} branch={selectedBranch} selectedLevel={seatLevel} />
      </section>

      <p className="cp-footnote">
        Closing ranks from official CET Cell CAP {data.year} allotment lists. Past cutoffs are a guide, not a guarantee.{" "}
        <Link to="/legal">Disclaimer</Link>
      </p>
    </div>
  );
}
