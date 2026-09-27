import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type CollegeFees, type CollegeFeesUnavailable } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { useCompare } from "../lib/CompareContext";
import { CutoffChart } from "../components/CutoffChart";
import "./CollegePage.css";

interface CutoffRow {
  choiceCode: string;
  branch: string;
  list: string;
  round: number;
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

export function CollegePage() {
  const { code } = useParams<{ code: string }>();
  const { profile } = useProfile();
  const { pin, unpin, isPinned: checkPinned, canPin } = useCompare();
  const [data, setData] = useState<CollegeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
        setFees(f);
      })
      .catch(() => setError("Could not load college data. Is the API running?"))
      .finally(() => setLoading(false));
  }, [code]);

  const merit = profile.meritNumber ?? null;

  // At a glance — per branch vs user's merit using GOPENS R1/R4
  const glance = useMemo(() => {
    if (!data || merit === null) return null;
    const branches = [...new Set(data.cutoffs.map((r) => r.branch))];
    const gotIn: string[] = [];
    const needBetter: string[] = [];

    for (const br of branches) {
      const rows = data.cutoffs.filter((r) => r.branch === br && r.seatType === "GOPENS");
      const r1 = rows.find((r) => r.round === 1);
      const r4 = rows.reduce<CutoffRow | null>((best, r) =>
        best === null || r.round > best.round ? r : best, null);

      if (r1 && merit <= r1.closingMerit) { gotIn.push(br); }
      else if (r4 && merit <= r4.closingMerit) { needBetter.push(br); }
    }
    return { gotIn, needBetter, total: branches.length };
  }, [data, merit]);

  // Auto-generated insight sentence
  const insight = useMemo(() => {
    if (!data) return null;
    const gopens = data.cutoffs.filter((r) => r.seatType === "GOPENS");
    if (gopens.length === 0) return null;

    const byBranch = new Map<string, { r1?: number; rLast?: number; lastRound?: number }>();
    for (const r of gopens) {
      const cur = byBranch.get(r.branch) ?? {};
      if (r.round === 1) cur.r1 = r.closingMerit;
      if (!cur.lastRound || r.round > cur.lastRound) {
        cur.rLast = r.closingMerit;
        cur.lastRound = r.round;
      }
      byBranch.set(r.branch, cur);
    }

    let bestBranch = "";
    let bestR1 = Infinity;
    byBranch.forEach((v, br) => {
      if (v.r1 !== undefined && v.r1 < bestR1) { bestR1 = v.r1; bestBranch = br; }
    });

    if (!bestBranch) return null;
    const b = byBranch.get(bestBranch)!;
    if (b.r1 && b.rLast && b.lastRound && b.lastRound > 1 && b.rLast > b.r1) {
      return `${bestBranch} closed at ${b.r1.toLocaleString("en-IN")} in Round I but opened up to ${b.rLast.toLocaleString("en-IN")} by Round ${b.lastRound} — worth checking later rounds.`;
    }
    if (b.r1) {
      return `${bestBranch} is the most competitive branch here, closing at ${b.r1.toLocaleString("en-IN")} in Round I.`;
    }
    return null;
  }, [data]);

  const best = useMemo(() => {
    if (!data) return null;
    const r1rows = data.cutoffs.filter((r) => r.seatType === "GOPENS" && r.round === 1);
    if (r1rows.length === 0) return null;
    return Math.max(...r1rows.map((r) => r.closingMerit));
  }, [data]);

  const sliderMax = useMemo(() => {
    if (!data) return 140000;
    const max = Math.max(...data.cutoffs.map((r) => r.closingMerit));
    return Math.ceil((max + 5000) / 1000) * 1000;
  }, [data]);

  if (loading) {
    return (
      <div className="college-page">
        <div className="cp-loading">Loading cutoffs…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="college-page">
        <div className="cp-error">
          <p>{error || "College not found."}</p>
          <Link to="/colleges" className="cp-back-link">← Back to colleges</Link>
        </div>
      </div>
    );
  }

  const pinned = code ? checkPinned(code) : false;

  return (
    <div className="college-page">
      <div className="cp-content">

        {/* Breadcrumb */}
        <nav className="cp-breadcrumb" aria-label="Breadcrumb">
          <Link to="/colleges">Find colleges</Link>
          <span aria-hidden="true"> / </span>
          <span>{data.college.name}</span>
        </nav>

        {/* Page header */}
        <header className="cp-page-header">
          <div className="cp-page-title">
            <h1>{data.college.name}</h1>
            <span className="cp-page-meta">{data.college.code} · {data.year}</span>
          </div>
          <div className="cp-page-actions">
            <button
              className={`cp-action-btn${linkCopied ? " copied" : ""}`}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
            >
              {linkCopied ? "✓ Copied" : "⤴ Share"}
            </button>
            {code && (
              <button
                className={`cp-action-btn${pinned ? " pinned" : ""}`}
                onClick={() => pinned ? unpin(code) : pin({ code, name: data.college.name })}
                disabled={!pinned && !canPin}
                title={pinned ? "Remove from comparison" : canPin ? "Pin to compare" : "Max 3 colleges"}
              >
                {pinned ? "◈ Comparing" : "◇ Compare"}
              </button>
            )}
          </div>
        </header>

        {/* Two-column body */}
        <div className="cp-body">

          {/* Main — charts + what-if */}
          <div className="cp-main">
            <div className="cp-whatif">
              <button
                className={`cp-whatif-toggle${showWhatif ? " open" : ""}`}
                onClick={() => setShowWhatif((v) => !v)}
              >
                <span>◈ What if my merit was…</span>
                <span className="cp-whatif-chevron">{showWhatif ? "▾" : "▸"}</span>
              </button>
              {showWhatif && (
                <div className="cp-whatif-body">
                  <div className="cp-slider-row">
                    <span className="cp-slider-label">Merit</span>
                    <input
                      type="range" min={1} max={sliderMax} step={50}
                      value={whatifMerit}
                      onChange={(e) => setWhatifMerit(parseInt(e.target.value, 10))}
                      className="cp-slider" aria-label="What-if merit number"
                    />
                    <span className="cp-slider-val">{whatifMerit.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}
            </div>

            <CutoffChart cutoffs={data.cutoffs} />
            <CutoffChart cutoffs={data.cutoffs} variant="category" />

            <div className="cp-footnote">
              2026 official MHT-CET CAP cutoffs · DTE Maharashtra ·{" "}
              <span className="cp-disclaimer">Past data — not a guarantee</span>
              {" · "}
              <Link to="/legal" className="cp-legal-link">Disclaimer</Link>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="cp-sidebar">

            {/* Best merit stat */}
            {best !== null && (
              <div className="cp-sidebar-card cp-stat-card">
                <span className="cp-stat-label">GOPENS · Round I</span>
                <span className="cp-stat-merit">{best.toLocaleString("en-IN")}</span>
                <span className="cp-stat-desc">best closing merit this college</span>
              </div>
            )}

            {/* At a glance */}
            {glance && glance.gotIn.length > 0 && (
              <div className="cp-sidebar-card">
                <h3 className="cp-sidebar-title">At a glance</h3>
                <div className="cp-glance-group">
                  <span className="cp-glance-label cp-glance-got">Branches you got into</span>
                  <div className="cp-glance-pills">
                    {glance.gotIn.map((br) => (
                      <span key={br} className="cp-glance-pill cp-glance-pill-got">{br}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Worth knowing */}
            {insight && (
              <div className="cp-sidebar-card cp-insight-card">
                <h3 className="cp-sidebar-title">Worth knowing</h3>
                <p className="cp-insight-text">{insight}</p>
                <Link to="/simulator" className="cp-insight-cta">Test in simulator →</Link>
              </div>
            )}

            {/* Fees */}
            {fees && fees.available && (
              <div className="cp-sidebar-card">
                <h3 className="cp-sidebar-title">Annual fees (FRA {fees.year})</h3>
                {fees.sampleOnly && <span className="cp-fees-sample-badge">sample data</span>}
                <div className="cp-fees-grid">
                  <div className="cp-fees-row">
                    <span>Tuition fee</span>
                    <span className="cp-fees-val">₹{fees.fees.tuitionFee.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="cp-fees-row">
                    <span>Development fee</span>
                    <span className="cp-fees-val">₹{fees.fees.developmentFee.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="cp-fees-row">
                    <span>Other fees</span>
                    <span className="cp-fees-val">₹{fees.fees.otherFees.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="cp-fees-row cp-fees-total">
                    <span>Total per year</span>
                    <span className="cp-fees-val">₹{fees.fees.totalAnnualFee.toLocaleString("en-IN")}</span>
                  </div>
                </div>
                {fees.tfwsAvailable && (
                  <div className="cp-fees-tfws">
                    TFWS — no tuition fee
                    {fees.tfwsSeats !== null && ` · ${fees.tfwsSeats} seats`}
                  </div>
                )}
                {fees.fraOrderRef && <div className="cp-fees-ref">Ref: {fees.fraOrderRef}</div>}
              </div>
            )}

          </aside>
        </div>
      </div>
    </div>
  );
}
