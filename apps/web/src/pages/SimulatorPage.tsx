import { useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import { loadList } from "../lib/list";
import { api, type SimulatedAllotment } from "../lib/api";
import "./SimulatorPage.css";

const ROUND_LABELS: Record<string, string> = {
  I: "Round I",
  II: "Round II",
  III: "Round III",
};

const ROUND_DESC: Record<string, string> = {
  I: "Initial allotment based on current preferences",
  II: "After Round I Freeze/Float/Slide deadline",
  III: "Final CAP round — last upgrade window",
};

export function SimulatorPage() {
  const { profile } = useProfile();
  const [result, setResult] = useState<SimulatedAllotment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const savedList = loadList();
  const prefCodes = savedList.map((i) => i.choiceCode);

  async function runSimulation() {
    if (!profile.meritNumber) {
      setError("Set your merit number in Profile first.");
      return;
    }
    if (prefCodes.length === 0) {
      setError("Your preference list is empty. Add options from the Find tab first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.simulate({
        merit: profile.meritNumber,
        homeUniversity: profile.homeUniversity || null,
        category: profile.category ?? null,
        gender: profile.gender,
        minorityCommunity: null,
        flags: {
          ews: profile.ews,
          tfws: profile.tfws,
          defence: profile.defence,
          pwd: profile.pwd,
          orphan: profile.orphan,
        },
        subjectGroup: profile.subjectGroup,
        preferences: prefCodes,
      });
      setResult(res.allotments);
    } catch {
      setError("Could not run simulation. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const noMerit = !profile.meritNumber;
  const noPrefs = prefCodes.length === 0;

  return (
    <div className="sim-page">
      <header className="sim-header">
        <h1>CAP Round Simulator</h1>
        <p>See where your preference list puts you in Rounds I, II, and III</p>
      </header>

      <div className="sim-body">
        {/* Profile summary */}
        <div className="sim-profile-card">
          <div className="sim-profile-row">
            <span className="sim-profile-label">Merit</span>
            <span className="sim-profile-val">
              {profile.meritNumber
                ? profile.meritNumber.toLocaleString("en-IN")
                : <Link to="/profile" className="sim-setup-link">Set merit →</Link>}
            </span>
          </div>
          <div className="sim-profile-row">
            <span className="sim-profile-label">Category</span>
            <span className="sim-profile-val">{profile.category ?? "Open"}</span>
          </div>
          <div className="sim-profile-row">
            <span className="sim-profile-label">Preferences</span>
            <span className="sim-profile-val">
              {prefCodes.length > 0
                ? `${prefCodes.length} saved`
                : <Link to="/" className="sim-setup-link">Build list →</Link>}
            </span>
          </div>
        </div>

        {(noMerit || noPrefs) && (
          <div className="sim-prereq">
            <span className="sim-prereq-icon">⚠</span>
            <div>
              <strong>Before you simulate:</strong>
              <ul>
                {noMerit && <li>Set your merit number in <Link to="/profile">Profile</Link></li>}
                {noPrefs && <li>Add options from the <Link to="/">Find</Link> tab to My List</li>}
              </ul>
            </div>
          </div>
        )}

        <button
          className={`sim-run-btn${loading ? " loading" : ""}`}
          onClick={runSimulation}
          disabled={loading || noMerit || noPrefs}
        >
          {loading ? "Simulating…" : "Run simulation"}
        </button>

        {error && <div className="sim-error">{error}</div>}

        {result !== null && (
          <div className="sim-results">
            <div className="sim-results-title">Simulated allotments</div>

            {(["I", "II", "III"] as const).map((round) => {
              const allotment = result.find((a) => a.round === round);
              return (
                <div key={round} className={`sim-round-card${allotment ? " allotted" : " vacant"}`}>
                  <div className="sim-round-head">
                    <span className="sim-round-label">{ROUND_LABELS[round]}</span>
                    <span className="sim-round-desc">{ROUND_DESC[round]}</span>
                  </div>
                  {allotment ? (
                    <div className="sim-round-allotment">
                      <div className="sim-allot-rank">Preference #{allotment.rank}</div>
                      <Link to={`/colleges/${allotment.choiceCode.slice(0, 4)}`} className="sim-allot-college">
                        {allotment.collegeName}
                      </Link>
                      <div className="sim-allot-branch">{allotment.branch}</div>
                      <div className="sim-allot-meta">
                        <span className="sim-allot-seat">{allotment.seatType}</span>
                        <span className="sim-allot-merit">
                          Closing {allotment.closingMerit.toLocaleString("en-IN")} · surplus{" "}
                          {(allotment.closingMerit - profile.meritNumber!).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="sim-round-vacant">
                      No allotment in this round based on current preference list
                    </div>
                  )}
                </div>
              );
            })}

            <div className="sim-note">
              This simulation uses 2026 official closing merits as a proxy for eligibility.
              Actual allotments depend on seat availability, candidate withdrawals, and CAP rules
              at the time of each round. Always verify with official DTE notifications.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
