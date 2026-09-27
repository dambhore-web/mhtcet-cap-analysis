import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { api, type CollegeFees, type CollegeFeesUnavailable } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { useCompare } from "../lib/CompareContext";
import { CutoffChart } from "../components/CutoffChart";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { avatarTint, collegeInitials, formatNumber, formatRound, roundIndex } from "../lib/format";
import { formatInr } from "../lib/plans";
import { isOpenSeat, seatTypeLabel, seatTypeShortLabel, seatTypeSortKey } from "../lib/seatType";
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
}

interface CollegeData {
  college: { code: string; name: string };
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useProfile();
  const { pin, unpin, isPinned: checkPinned, canPin } = useCompare();
  const [data, setData] = useState<CollegeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "gopens" | "reserved">(() => {
    const s = searchParams.get("seat");
    return (s === "gopens" || s === "reserved") ? s : "all";
  });
  const [whatifMerit, setWhatifMerit] = useState<number>(() => profile.meritNumber ?? 10000);
  const [showWhatif, setShowWhatif] = useState(false);
  const [fees, setFees] = useState<CollegeFees | CollegeFeesUnavailable | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    Promise.all([
      api.collegeCutoffs(code),
      api.collegeFees(code).catch(() => null),
    ])
      .then(([d, f]) => {
        setData(d as CollegeData);
        const branches = [...new Set((d.cutoffs as CutoffRow[]).map((r) => r.branch))].sort();
        if (branches.length > 0) setSelectedBranch(branches[0]);
        setFees(f);
      })
      .catch(() => setError("Could not load college data. Is the API running?"))
      .finally(() => setLoading(false));
  }, [code]);

  const branches = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.cutoffs.map((r) => r.branch))].sort();
  }, [data]);

  const rounds = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.cutoffs.map((r) => r.round))].sort((a, b) => roundIndex(a) - roundIndex(b));
  }, [data]);

  const branchRows = useMemo(() => {
    if (!data || !selectedBranch) return [];
    const rows = data.cutoffs.filter((r) => r.branch === selectedBranch);

    const bySeat = new Map<string, Map<number | string, CutoffRow>>();
    for (const row of rows) {
      if (!bySeat.has(row.seatType)) bySeat.set(row.seatType, new Map());
      bySeat.get(row.seatType)!.set(row.round, row);
    }

    return [...bySeat.entries()]
      .filter(([seatType]) => {
        if (filter === "gopens") return seatType === "GOPENS";
        if (filter === "reserved") {
          return !isOpenSeat(seatType);
        }
        return true;
      })
      .sort(([a], [b]) => seatTypeSortKey(a) - seatTypeSortKey(b));
  }, [data, selectedBranch, filter]);

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
        subtitle={`College code ${data.college.code} · closing ranks from CAP ${data.year}`}
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
              <div><dt>Tuition</dt><dd>{formatInr(fees.fees.tuitionFee)}</dd></div>
              <div><dt>Development</dt><dd>{formatInr(fees.fees.developmentFee)}</dd></div>
              <div><dt>Other</dt><dd>{formatInr(fees.fees.otherFees)}</dd></div>
            </dl>
            {fees.tfwsAvailable && (
              <p className="cp-fees-tfws">
                <Icon name="tag" size={14} />
                Tuition fee waiver (TFWS) seats available{fees.tfwsSeats !== null && `: ${fees.tfwsSeats}`}. TFWS students pay no tuition.
              </p>
            )}
            <p className="cp-fees-note">
              As approved by the Fee Regulating Authority. Confirm with the college before paying
              {fees.fraOrderUrl ? (
                <>
                  {" "}(<a href={fees.fraOrderUrl} target="_blank" rel="noreferrer">FRA order</a>).
                </>
              ) : (
                "."
              )}
            </p>
          </section>
        )}
      </div>

      <div className="page-section">
        <CutoffChart cutoffs={data.cutoffs} />
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

        <label className="label" htmlFor="cp-branch-select">Branch</label>
        <div className="cp-branch-picker">
          <select
            id="cp-branch-select"
            className="cp-select"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branches.map((b) => {
              const st = showWhatif ? getBranchStatus(data.cutoffs, b, whatifMerit) : null;
              const tag = st === "round-I" ? ` — ${formatRound(1)}` : st === "later" ? " — later round" : st === "out" ? " — out of reach" : "";
              return <option key={b} value={b}>{b}{tag}</option>;
            })}
          </select>
          <div className="cp-filter-row" role="group" aria-label="Seat types">
            {([
              ["all", "All seats"],
              ["gopens", "General open"],
              ["reserved", "Reserved"],
            ] as const).map(([f, label]) => (
              <button
                key={f}
                type="button"
                className={`cp-filter${filter === f ? " active" : ""}`}
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f);
                  setSearchParams(f === "all" ? {} : { seat: f }, { replace: true });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {branchRows.length === 0 ? (
          <div className="empty-state">
            <p>No closing ranks for this branch and seat filter.</p>
          </div>
        ) : (
          <div className="table-scroll" role="region" aria-label={`Closing ranks for ${selectedBranch}`} tabIndex={0}>
            <table className="cp-table">
              <thead>
                <tr>
                  <th scope="col" className="cp-th-seat">Seat type</th>
                  {rounds.map((r) => (
                    <th scope="col" key={r} className="cp-th-round">{formatRound(r)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchRows.map(([seatType, roundMap]) => (
                  <tr key={seatType} className={seatType === "GOPENS" ? "cp-tr-highlight" : ""}>
                    <th scope="row" className="cp-td-seat">
                      <span className="seat-full">{seatTypeShortLabel(seatType)}</span>
                      <span className="seat-code" title={seatTypeLabel(seatType)}>{seatType}</span>
                    </th>
                    {rounds.map((r) => {
                      const row = roundMap.get(r);
                      return (
                        <td key={r} className="cp-td-merit">
                          {row ? formatNumber(row.closingMerit) : <span className="merit-na" aria-label="no seat allotted">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="cp-footnote">
        Closing ranks from official CET Cell CAP {data.year} allotment lists. Past cutoffs are a guide, not a guarantee.{" "}
        <Link to="/legal">Disclaimer</Link>
      </p>
    </div>
  );
}
