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
        <div className="cp-header-skeleton" />
        <div className="cp-loading">Loading cutoffs…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="college-page">
        <div className="cp-error">
          <p>{error || "College not found."}</p>
          <Link to="/colleges" className="cp-back">← Back to colleges</Link>
        </div>
      </div>
    );
  }

  const initials = data.college.name
    .split(" ")
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="college-page">
      <header className="cp-header">
        <Link to="/colleges" className="cp-back-btn" aria-label="Back to colleges">←</Link>
        <div className="cp-college-tile" aria-hidden="true">{initials || code?.slice(-2)}</div>
        <div className="cp-title">
          <h1>{data.college.name}</h1>
          <span className="cp-code">{data.college.code} · {data.year}</span>
        </div>
        <button
          className={`cp-share-btn${linkCopied ? " copied" : ""}`}
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          }}
          title="Copy link to this page"
        >
          {linkCopied ? "✓" : "⤴"}
        </button>
        {code && (() => {
          const pinned = checkPinned(code);
          return (
            <button
              className={`cp-pin-btn${pinned ? " pinned" : ""}`}
              onClick={() => pinned ? unpin(code) : pin({ code, name: data.college.name })}
              disabled={!pinned && !canPin}
              title={pinned ? "Remove from comparison" : canPin ? "Pin to compare" : "Max 3 colleges"}
            >
              {pinned ? "◈ Pinned" : "◇ Compare"}
            </button>
          );
        })()}
      </header>

      {best !== null && (
        <div className="cp-best-bar">
          <span className="cp-best-label">GOPENS Round I</span>
          <span className="cp-best-merit">{best.toLocaleString("en-IN")}</span>
          <span className="cp-best-desc">best cutoff this college</span>
        </div>
      )}

      {fees && fees.available && (
        <div className="cp-fees-card">
          <div className="cp-fees-head">
            <span className="cp-fees-title">Annual fees (FRA {fees.year})</span>
            {fees.sampleOnly && <span className="cp-fees-sample-badge">sample data</span>}
          </div>
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
              TFWS seats available — no tuition fee (pay non-tuition fees only)
              {fees.tfwsSeats !== null && <span> · {fees.tfwsSeats} seats</span>}
            </div>
          )}
          <div className="cp-fees-disclaimer">{fees.disclaimer}</div>
          {fees.fraOrderRef && <div className="cp-fees-ref">Ref: {fees.fraOrderRef}</div>}
        </div>
      )}

      <div className="cp-whatif">
        <button
          className={`cp-whatif-toggle${showWhatif ? " open" : ""}`}
          onClick={() => setShowWhatif((v) => !v)}
        >
          <span className="cp-whatif-icon">◈</span>
          What if my merit was…
          <span className="cp-whatif-chevron">{showWhatif ? "▾" : "▸"}</span>
        </button>
        {showWhatif && (
          <div className="cp-whatif-body">
            <div className="cp-slider-row">
              <span className="cp-slider-label">Merit</span>
              <input
                type="range"
                min={1}
                max={sliderMax}
                step={50}
                value={whatifMerit}
                onChange={(e) => setWhatifMerit(parseInt(e.target.value, 10))}
                className="cp-slider"
                aria-label="What-if merit number"
              />
              <span className="cp-slider-val">{whatifMerit.toLocaleString("en-IN")}</span>
            </div>
            <div className="cp-whatif-legend">
              <span className="cp-wl-dot wi-r1" />Round I
              <span className="cp-wl-dot wi-later" />Later round
              <span className="cp-wl-dot wi-out" />Not accessible
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
  );
}
