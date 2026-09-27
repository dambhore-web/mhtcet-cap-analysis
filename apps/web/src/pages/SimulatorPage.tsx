import { useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import { loadList } from "../lib/list";
import { api, type SimulatedAllotment } from "../lib/api";
import "./SimulatorPage.css";

const ROUNDS = ["I", "II", "III"] as const;
type Round = typeof ROUNDS[number];

export function SimulatorPage() {
  const { profile } = useProfile();
  const [result, setResult] = useState<SimulatedAllotment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const savedList = loadList();
  const prefCodes = savedList.map((i) => i.choiceCode);
  const noMerit = !profile.meritNumber;
  const noPrefs = prefCodes.length === 0;

  async function runSimulation() {
    if (noMerit || noPrefs) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.simulate({
        merit: profile.meritNumber!,
        homeUniversity: profile.homeUniversity || null,
        category: profile.category ?? null,
        gender: profile.gender,
        minorityCommunity: null,
        flags: { ews: profile.ews, tfws: profile.tfws, defence: profile.defence, pwd: profile.pwd, orphan: profile.orphan },
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

  const r1 = result?.find((a) => a.round === "I") ?? null;
  const rFinal = result ? ([...result].sort((a, b) =>
    ROUNDS.indexOf(b.round as Round) - ROUNDS.indexOf(a.round as Round))[0] ?? null) : null;
  const movedUp = r1 && rFinal && rFinal.round !== "I" && rFinal.rank < r1.rank
    ? r1.rank - rFinal.rank
    : 0;
  const floatRecommended = movedUp > 0;

  return (
    <div className="sim-page">
      <div className="sim-content">

        {/* Page header */}
        <div className="sim-page-header">
          <div>
            {result && profile.meritNumber && (
              <span className="sim-replay-badge">
                Replaying CAP 2026 with {prefCodes.length} options · merit {profile.meritNumber.toLocaleString("en-IN")}
              </span>
            )}
            <h1 className="sim-title">
              {result && r1
                ? <>With this list you would have started in <span className="sim-title-got">{r1.branch}</span>
                  {rFinal && rFinal.round !== "I" && <> and {floatRecommended ? "moved up to" : "stayed at"} <span className={floatRecommended ? "sim-title-moved" : "sim-title-got"}>{rFinal.branch}</span> by Round {rFinal.round}</>}.</>
                : "CAP Round Simulator"}
            </h1>
            {result && (
              <p className="sim-subtitle">A replay of last year's cutoffs. This year's will be different — treat it as a rehearsal, not a prediction.</p>
            )}
          </div>
          <Link to="/list" className="sim-edit-btn">Edit my list</Link>
        </div>

        {/* Pre-run state */}
        {!result && (
          <div className="sim-pre">
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
                <strong>Before you simulate:</strong>
                <ul>
                  {noMerit && <li>Set your merit number in <Link to="/profile">Profile</Link></li>}
                  {noPrefs && <li>Add options from the <Link to="/">Find</Link> tab</li>}
                </ul>
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
          </div>
        )}

        {/* Result */}
        {result && (
          <>
            {/* 4 round cards */}
            <div className="sim-round-cards">
              {ROUNDS.map((round) => {
                const a = result.find((x) => x.round === round);
                const isFinal = round === ROUNDS[ROUNDS.length - 1];
                return (
                  <div key={round} className={`sim-rcard${a ? " sim-rcard-allotted" : " sim-rcard-empty"}${isFinal && a ? " sim-rcard-final" : ""}`}>
                    <span className="sim-rcard-label">Round {round}</span>
                    {a ? (
                      <>
                        <span className="sim-rcard-branch">{a.branch}</span>
                        <span className="sim-rcard-meta">Option {a.rank} · closed at <span className="sim-rcard-merit">{a.closingMerit.toLocaleString("en-IN")}</span></span>
                        {isFinal && movedUp > 0 && (
                          <span className="sim-rcard-badge">↑ Moved up {movedUp} option{movedUp > 1 ? "s" : ""}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="sim-rcard-branch sim-rcard-empty-text">No allotment</span>
                        <span className="sim-rcard-meta">No seat found in this round</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 2-column: round table + F/F/S sidebar */}
            <div className="sim-body-grid">
              {/* Round detail list */}
              <section className="sim-rounds-section">
                <div className="sim-rounds-head">
                  <span className="sim-rounds-title">Your list, round by round</span>
                  <span className="sim-rounds-hint">Based on 2026 closing merits</span>
                </div>
                {ROUNDS.map((round) => {
                  const a = result.find((x) => x.round === round);
                  return (
                    <div key={round} className="sim-round-detail">
                      <div className="sim-rd-label">Round {round}</div>
                      {a ? (
                        <div className="sim-rd-allotment">
                          <div className="sim-rd-rank">Option {a.rank}</div>
                          <Link to={`/colleges/${a.choiceCode.slice(0, 4)}`} className="sim-rd-college">
                            {a.collegeName}
                          </Link>
                          <div className="sim-rd-branch">{a.branch} · {a.seatType}</div>
                          <div className="sim-rd-merit">
                            Closed at {a.closingMerit.toLocaleString("en-IN")} ·{" "}
                            surplus {(a.closingMerit - profile.meritNumber!).toLocaleString("en-IN")}
                          </div>
                        </div>
                      ) : (
                        <div className="sim-rd-vacant">No seat in this round</div>
                      )}
                    </div>
                  );
                })}
                <div className="sim-note">
                  Simulation uses 2026 closing merits as eligibility proxy. Actual allotments depend on seat availability and candidate withdrawals.
                </div>
              </section>

              {/* Freeze / Float / Slide sidebar */}
              <aside className="sim-ffs-sidebar">
                {r1 && (
                  <section className="sim-ffs-card">
                    <h3 className="sim-ffs-title">After Round I, what to choose</h3>
                    <div className="sim-ffs-option">
                      <span className="sim-ffs-name">Freeze</span>
                      <span className="sim-ffs-desc">Keep {r1.branch} and stop. You won't be considered for higher options again.</span>
                    </div>
                    <div className={`sim-ffs-option${floatRecommended ? " sim-ffs-recommended" : ""}`}>
                      <div className="sim-ffs-name-row">
                        <span className="sim-ffs-name">Float (betterment)</span>
                        {floatRecommended && <span className="sim-ffs-hint">What last year suggests</span>}
                      </div>
                      <span className="sim-ffs-desc">
                        Accept and stay in line for higher options.
                        {floatRecommended && rFinal && ` Last year this would have moved you to ${rFinal.branch} by Round ${rFinal.round}.`}
                      </span>
                    </div>
                    <div className="sim-ffs-option">
                      <span className="sim-ffs-name">Slide</span>
                      <span className="sim-ffs-desc">Stay at the same college and move only to a higher-ranked branch there.</span>
                    </div>
                    <p className="sim-ffs-fee-note">Seat acceptance fee rises each time: ₹1,000 → ₹2,000 → ₹3,000</p>
                  </section>
                )}
                <Link to="/ask" className="sim-ask-cta">
                  Not sure? Ask Compass about your allotment
                  <span aria-hidden="true"> →</span>
                </Link>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
