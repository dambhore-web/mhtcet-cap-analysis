import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api, type CollegeFees, type CollegeFeesUnavailable } from "../lib/api";
import { useCompare } from "../lib/CompareContext";
import { addToList, isInList } from "../lib/list";
import { useProfile } from "../lib/ProfileContext";
import "./ComparePage.css";

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
const ROUND_LABELS: Record<string, string> = { I: "Round I", II: "Round II", III: "Round III", IV: "Round IV" };

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

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
      <div className="compare-page">
        <header className="compare-header">
          <Link to="/colleges" className="compare-back">←</Link>
          <h1>Compare colleges</h1>
        </header>
        <div className="compare-empty">
          <p>No colleges pinned yet.</p>
          <p>Open a college page and tap "Pin to compare" to add it here.</p>
          <Link to="/colleges" className="compare-empty-link">Browse colleges →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="compare-page">
      <header className="compare-header">
        <Link to="/colleges" className="compare-back">←</Link>
        <h1>Compare colleges</h1>
        <span className="compare-count">{pinned.length} / 3</span>
      </header>

      <div className="compare-scroll">
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
                  <div className="compare-col-name">{c.name}</div>
                  <div className="compare-col-code">{c.code}</div>
                  <div className="compare-col-actions">
                    <Link to={`/colleges/${c.code}`} className="compare-view-btn">View →</Link>
                    <button className="compare-unpin-btn" onClick={() => unpin(c.code)}>Remove</button>
                  </div>
                </div>

                {data === undefined && (
                  <div className="compare-loading">Loading…</div>
                )}

                {data === null && (
                  <div className="compare-error">Could not load data</div>
                )}

                {data && (
                  <>
                    <div className="compare-branch-row">
                      <label className="compare-branch-label">Branch</label>
                      <select
                        className="compare-branch-select"
                        value={branch}
                        onChange={(e) => setSelectedBranches((prev) => ({ ...prev, [c.code]: e.target.value }))}
                      >
                        {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div className="compare-section-title">GOPENS closing merit</div>
                    <div className="compare-merit-rows">
                      {ROUNDS.map((r) => {
                        const m = gopensForBranch(data.cutoffs, branch, r);
                        const surplus = m !== null && merit > 0 ? m - merit : null;
                        return (
                          <div key={r} className={`compare-merit-row${r === "I" ? " r1" : ""}`}>
                            <span className="compare-round-label">{ROUND_LABELS[r]}</span>
                            <span className="compare-merit-val">
                              {m !== null ? fmt(m) : <span className="compare-na">—</span>}
                            </span>
                            {surplus !== null && (
                              <span className={`compare-surplus${surplus >= 0 ? " pos" : " neg"}`}>
                                {surplus >= 0 ? `+${fmt(surplus)}` : fmt(surplus)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="compare-section-title">Fees</div>
                    {totalFee !== null ? (
                      <div className="compare-fee-row">
                        <span className="compare-fee-label">Total per year</span>
                        <span className="compare-fee-val">₹{fmt(totalFee)}</span>
                      </div>
                    ) : (
                      <div className="compare-na-row">Fee data not yet available</div>
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
        2026 official MHT-CET CAP cutoffs · GOPENS only · Past data — not a guarantee
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
    <button className={`compare-add-btn${saved ? " saved" : ""}`} onClick={handleAdd}>
      {saved ? "✓ Saved to list" : "+ Add to preference list"}
    </button>
  );
}
