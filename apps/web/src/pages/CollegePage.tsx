import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type CollegeFees, type CollegeFeesUnavailable } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { useCompare } from "../lib/CompareContext";
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

const ROUND_LABELS: Record<number, string> = { 1: "R1", 2: "R2", 3: "R3", 4: "R4" };

const SEAT_ORDER = [
  "GOPENS", "GOPENH", "LOPENS", "LOPENH",
  "GOBCSS", "GOBCSH", "LOBCSS", "LOBCSH",
  "GOSCS", "GOSCSH", "GOSTS", "GOSTH",
  "GOVJS", "GOVJIH", "GONT1S", "GONT1H",
  "GONT2S", "GONT2H", "GONT3S", "GONT3H",
  "GOSEBCS", "GOSEBCH",
  "EWSS", "EWSH", "TFWS", "MI",
  "ORPHANI", "ORPHANN", "PWDS", "PWDH",
  "DEFS", "DEFH",
];

function seatOrder(seatType: string): number {
  const i = SEAT_ORDER.indexOf(seatType);
  return i === -1 ? 99 : i;
}

function seatLabel(seatType: string): string {
  const map: Record<string, string> = {
    GOPENS: "GOPENS (General Open)", GOPENH: "GOPENH (Ladies)",
    LOPENS: "LOPENS (Home Univ.)", LOPENH: "LOPENH (Ladies HU)",
    GOBCSS: "OBC State", GOBCSH: "OBC Ladies", LOBCSS: "OBC HU", LOBCSH: "OBC HU Ladies",
    GOSCS: "SC State", GOSCSH: "SC Ladies", GOSTS: "ST State", GOSTH: "ST Ladies",
    GOVJS: "VJ/DT State", GONT1S: "NT-A", GONT2S: "NT-B", GONT3S: "NT-C",
    GOSEBCS: "SEBC State", GOSEBCH: "SEBC Ladies",
    EWSS: "EWS", EWSH: "EWS Ladies", TFWS: "TFWS (Fee Waiver)",
    MI: "Minority", ORPHANI: "Orphan (AI)", ORPHANN: "Orphan (MH)",
    PWDS: "PWD", PWDH: "PWD Ladies", DEFS: "Defence", DEFH: "Defence Ladies",
  };
  return map[seatType] ?? seatType;
}

type BranchStatus = "round-I" | "later" | "out";

function getBranchStatus(cutoffs: CutoffRow[], branch: string, merit: number): BranchStatus {
  const rows = cutoffs.filter((r) => r.branch === branch && r.seatType === "GOPENS");
  if (rows.length === 0) return "out";
  const r1 = rows.find((r) => r.round === 1);
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
  const [filter, setFilter] = useState<"all" | "gopens" | "reserved">("all");
  const [whatifMerit, setWhatifMerit] = useState<number>(() => profile.meritNumber ?? 10000);
  const [showWhatif, setShowWhatif] = useState(false);
  const [fees, setFees] = useState<CollegeFees | CollegeFeesUnavailable | null>(null);

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
    return [...new Set(data.cutoffs.map((r) => r.round))].sort();
  }, [data]);

  const branchRows = useMemo(() => {
    if (!data || !selectedBranch) return [];
    const rows = data.cutoffs.filter((r) => r.branch === selectedBranch);

    const bySeat = new Map<string, Map<number, CutoffRow>>();
    for (const row of rows) {
      if (!bySeat.has(row.seatType)) bySeat.set(row.seatType, new Map());
      bySeat.get(row.seatType)!.set(row.round, row);
    }

    return [...bySeat.entries()]
      .filter(([seatType]) => {
        if (filter === "gopens") return seatType === "GOPENS";
        if (filter === "reserved") {
          return !["GOPENS", "GOPENH", "LOPENS", "LOPENH"].includes(seatType);
        }
        return true;
      })
      .sort(([a], [b]) => seatOrder(a) - seatOrder(b));
  }, [data, selectedBranch, filter]);

  const best = useMemo(() => {
    const gopens = branchRows.find(([st]) => st === "GOPENS");
    if (!gopens) return null;
    const round1 = gopens[1].get(1);
    return round1 ? round1.closingMerit : null;
  }, [branchRows]);

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

      <div className="cp-branches">
        <div className="cp-branches-scroll" role="tablist" aria-label="Select branch">
          {branches.map((b) => {
            const status = showWhatif ? getBranchStatus(data.cutoffs, b, whatifMerit) : null;
            return (
              <button
                key={b}
                role="tab"
                aria-selected={selectedBranch === b}
                className={[
                  "cp-branch-chip",
                  selectedBranch === b ? "active" : "",
                  status ? `wi-${status}` : "",
                ].filter(Boolean).join(" ")}
                onClick={() => setSelectedBranch(b)}
              >
                {b}
                {status && <span className={`cp-branch-dot wi-${status}`} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cp-filter-row">
        <button className={`cp-filter${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>All seats</button>
        <button className={`cp-filter${filter === "gopens" ? " active" : ""}`} onClick={() => setFilter("gopens")}>GOPENS only</button>
        <button className={`cp-filter${filter === "reserved" ? " active" : ""}`} onClick={() => setFilter("reserved")}>Reserved seats</button>
      </div>

      <div className="cp-table-wrap" role="region" aria-label="Cutoff table">
        {branchRows.length === 0 ? (
          <div className="cp-empty">No data for this filter.</div>
        ) : (
          <table className="cp-table">
            <thead>
              <tr>
                <th className="cp-th-seat">Seat type</th>
                {rounds.map((r) => (
                  <th key={r} className="cp-th-round">{ROUND_LABELS[r] ?? `R${r}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branchRows.map(([seatType, roundMap]) => (
                <tr key={seatType} className={seatType === "GOPENS" ? "cp-tr-highlight" : ""}>
                  <td className="cp-td-seat" title={seatType}>
                    <span className="seat-badge">{seatType}</span>
                    <span className="seat-full">{seatLabel(seatType)}</span>
                  </td>
                  {rounds.map((r) => {
                    const row = roundMap.get(r);
                    return (
                      <td key={r} className="cp-td-merit">
                        {row ? (
                          <span className="merit-val">{row.closingMerit.toLocaleString("en-IN")}</span>
                        ) : (
                          <span className="merit-na">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="cp-footnote">
        2026 official MHT-CET CAP cutoffs · DTE Maharashtra ·{" "}
        <span className="cp-disclaimer">Past data — not a guarantee</span>
      </div>
    </div>
  );
}
