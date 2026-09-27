import { useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import { loadList } from "../lib/list";
import { api, type SimulatedAllotment } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { PlanSubnav } from "../components/PlanSubnav";
import { Icon } from "../components/Icon";
import { formatNumber, formatRound, formatRoundRange } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import { CATEGORY_OPTIONS } from "../lib/categories";
import "./SimulatorPage.css";

const ROUND_DESC: Record<string, string> = {
  I: "First allotment from your option form",
  II: "After you freeze, float or slide in Round I",
  III: "Last CAP round for upgrades",
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
      setError("Add your merit number in My details first.");
      return;
    }
    if (prefCodes.length === 0) {
      setError("Your option form is empty. Add options from Find first.");
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
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === (profile.category ?? ""))?.label ?? "Open";

  return (
    <div className="page sim-page">
      <PageHeader
        breadcrumb={[{ label: "My CAP plan", to: "/list" }, { label: "Simulator" }]}
        title="Test your option form"
        subtitle={`See which of your choices you would likely be allotted in ${formatRoundRange(1, 3)}, based on last year's closing ranks.`}
      />
      <PlanSubnav />

      <div className="sim-layout">
        <aside className="sim-setup card" aria-label="Simulation inputs">
          <dl className="sim-profile">
            <div>
              <dt>Merit number</dt>
              <dd>{profile.meritNumber ? formatNumber(profile.meritNumber) : <Link to="/profile">Add merit number</Link>}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{categoryLabel}</dd>
            </div>
            <div>
              <dt>Choices in option form</dt>
              <dd>{noPrefs ? <Link to="/">Add options</Link> : formatNumber(prefCodes.length)}</dd>
            </div>
          </dl>
          <button type="button" className="btn btn-primary btn-block" onClick={runSimulation} disabled={loading || noMerit || noPrefs}>
            <Icon name="play" size={18} />
            {loading ? "Simulating…" : "Run simulation"}
          </button>
          <Link to="/list" className="btn btn-ghost btn-block btn-sm">Edit option form</Link>
        </aside>

        <div className="sim-main">
          {(noMerit || noPrefs) && (
            <div className="empty-state">
              <Icon name="steps" size={28} className="empty-state-icon" />
              <h2>Two things before you simulate</h2>
              <ol className="sim-prereq-list">
                <li className={noMerit ? "" : "done"}>
                  <Icon name={noMerit ? "minus" : "check"} size={16} />
                  {noMerit ? <span><Link to="/profile">Add your merit number</Link> in My details</span> : "Merit number added"}
                </li>
                <li className={noPrefs ? "" : "done"}>
                  <Icon name={noPrefs ? "minus" : "check"} size={16} />
                  {noPrefs ? <span><Link to="/">Find your options</Link> and add a few to your option form</span> : "Option form has choices"}
                </li>
              </ol>
            </div>
          )}

          {error && (
            <div className="sim-error" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}

          {!noMerit && !noPrefs && result === null && !loading && !error && (
            <div className="empty-state">
              <h2>Ready to simulate</h2>
              <p>Run the simulation to see your likely allotment in each round. Change the order of your option form and run again to compare.</p>
            </div>
          )}

          {result !== null && (
            <ol className="sim-results" aria-label="Simulated allotments">
              {(["I", "II", "III"] as const).map((round) => {
                const allotment = result.find((a) => a.round === round);
                return (
                  <li key={round} className={`sim-round-card card${allotment ? " allotted" : " vacant"}`}>
                    <div className="sim-round-head">
                      <span className="sim-round-label">{formatRound(round)}</span>
                      <span className="sim-round-desc">{ROUND_DESC[round]}</span>
                    </div>
                    {allotment ? (
                      <div className="sim-round-allotment">
                        <span className="badge badge-safe">
                          <Icon name="check" size={12} />
                          Choice {allotment.rank} on your list
                        </span>
                        <Link to={`/colleges/${allotment.choiceCode.slice(0, 4)}`} className="sim-allot-college">
                          {allotment.collegeName}
                        </Link>
                        <span className="sim-allot-branch">{allotment.branch}</span>
                        <span className="sim-allot-meta">
                          <abbr title={seatTypeLabel(allotment.seatType)}>{seatTypeShortLabel(allotment.seatType)}</abbr>
                          {" · "}closed at {formatNumber(allotment.closingMerit)}
                          {profile.meritNumber ? ` · ${formatNumber(allotment.closingMerit - profile.meritNumber)} ranks to spare` : ""}
                        </span>
                      </div>
                    ) : (
                      <p className="sim-round-vacant">No choice on your list is likely in this round.</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {result !== null && (
            <p className="sim-note">
              Uses last year's official closing ranks. Real allotments also depend on seats left, other candidates'
              choices and CAP rules for each round. Always check the CET Cell notices.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
