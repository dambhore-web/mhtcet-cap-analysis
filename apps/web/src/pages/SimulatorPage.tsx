import { useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import { useList } from "../lib/list";
import { api, type SimulateResponse, type SimulatedRound } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { PlanNextStep, PlanSubnav } from "../components/PlanSubnav";
import { Icon } from "../components/Icon";
import { formatNumber, formatRound } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import { CATEGORY_OPTIONS } from "../lib/categories";
import "./SimulatorPage.css";

const ROUNDS = ["I", "II", "III", "IV"] as const;

function zoneText(round: SimulatedRound["round"], zones: SimulateResponse["freezeZones"]): string {
  if (round === "IV") return "Final round: allotments are final";
  const n = zones[round];
  return n === 1 ? "Freeze zone: choice 1" : `Freeze zone: choices 1–${n}`;
}

function headline(r: SimulateResponse): string {
  const first = r.rounds.find((x) => x.preference);
  const last = r.rounds[r.rounds.length - 1];
  if (!first || !last.preference) return "With this list you would not have got a seat last year.";
  const start = `choice ${first.preference} (${first.choice?.branch ?? "?"}) in ${formatRound(first.round)}`;
  if (last.preference === first.preference) return `With this list you would have got ${start} and stayed there.`;
  return `With this list you would have started with ${start} and moved up to choice ${last.preference} (${last.choice?.branch ?? "?"}) by ${formatRound(last.round)}.`;
}

/** My CAP plan step 2, journey J9: "Where would this list actually land me?" */
export function SimulatorPage() {
  const { profile } = useProfile();
  const items = useList();
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Bumped on every run so the rounds replay their reveal
  const [runCount, setRunCount] = useState(0);
  const merit = profile.meritNumber;
  const noMerit = !merit;
  const noPrefs = items.length === 0;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === (profile.category ?? ""))?.label ?? "Open";

  async function run() {
    if (!merit || noPrefs) return;
    setLoading(true);
    setError("");
    try {
      setResult(
        await api.simulate({
          merit,
          homeUniversity: profile.homeUniversity || null,
          category: profile.category ?? null,
          gender: profile.gender,
          minorityCommunity: profile.minorityCommunity,
          flags: { ews: profile.ews, tfws: profile.tfws, defence: profile.defence, pwd: profile.pwd, orphan: profile.orphan },
          subjectGroup: profile.subjectGroup,
          preferences: items.map((i) => i.choiceCode),
        }),
      );
      setRunCount((n) => n + 1);
    } catch {
      setError("Couldn't run the simulation. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const afterRoundI = result?.rounds[0];

  return (
    <div className="page sim-page">
      <PageHeader
        breadcrumb={[{ label: "My CAP plan", to: "/list" }, { label: "Simulator" }]}
        title="Test your option form"
        subtitle="Replays last year's four CAP rounds with your list and the auto-freeze rule, so you can see where you would have landed."
      />
      <PlanSubnav />

      <div className="sim-layout">
        <aside className="sim-setup card" aria-label="Simulation inputs">
          <dl className="sim-profile">
            <div><dt>Merit number</dt><dd>{merit ? formatNumber(merit) : <Link to="/profile">Add merit number</Link>}</dd></div>
            <div><dt>Category</dt><dd>{categoryLabel}</dd></div>
            <div><dt>Choices in option form</dt><dd>{noPrefs ? <Link to="/list">Add options</Link> : formatNumber(items.length)}</dd></div>
          </dl>
          <button type="button" className="btn btn-primary btn-block" onClick={run} disabled={loading || noMerit || noPrefs}>
            <Icon name="play" size={18} />
            {loading ? "Replaying…" : result ? "Run again" : "Run simulation"}
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
                  {noPrefs ? <span><Link to="/find">Find your options</Link> and add a few to your option form</span> : "Option form has choices"}
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

          {!noMerit && !noPrefs && !result && !loading && !error && (
            <div className="empty-state">
              <h2>Ready to simulate</h2>
              <p>Run the simulation, then reorder your option form and run it again to compare.</p>
            </div>
          )}

          {result && (
            <>
              <p className="sim-headline" aria-live="polite">{headline(result)}</p>
              <p className="sim-note">{result.assumptions}</p>

              <ol className="sim-rounds" aria-label="Round by round">
                {result.rounds.map((r, i) => (
                  <li
                    key={`${runCount}-${r.round}`}
                    className={`card sim-round${r.preference ? " allotted" : ""}${r.movedUp ? " moved" : ""}`}
                    style={{ animationDelay: `${i * 220}ms` }}
                  >
                    <div className="sim-round-head">
                      <span className="sim-round-label">{formatRound(r.round)}</span>
                      <span className="sim-round-zone">{zoneText(r.round, result.freezeZones)}</span>
                    </div>
                    {r.preference && r.choice ? (
                      <div className="sim-round-body">
                        <span className="sim-choice">Choice {r.preference}</span>
                        <span className="sim-tags">
                          {r.movedUp && <span className="badge badge-later"><Icon name="arrowUp" size={12} />Moved up</span>}
                          {r.frozen && !r.frozenEarlier && <span className="badge badge-out"><Icon name="lock" size={12} />Frozen</span>}
                          {r.frozenEarlier && <span className="badge badge-out"><Icon name="lock" size={12} />Frozen earlier</span>}
                        </span>
                        {r.choice.collegeCode ? (
                          <Link to={`/colleges/${r.choice.collegeCode}`} className="sim-college">{r.choice.collegeName}</Link>
                        ) : (
                          <span className="sim-college">{r.choice.choiceCode}</span>
                        )}
                        <span className="sim-branch">{r.choice.branch}</span>
                        {r.seatType && r.closingMerit != null && (
                          <span className="sim-meta">
                            <abbr title={seatTypeLabel(r.seatType)}>{seatTypeShortLabel(r.seatType)}</abbr> · closed at {formatNumber(r.closingMerit)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="sim-empty">No choice on your list had a seat for your merit.</p>
                    )}
                  </li>
                ))}
              </ol>

              <section className="card sim-grid" aria-labelledby="sim-grid-title">
                <h2 id="sim-grid-title">Your list, round by round</h2>
                <p className="sim-note">Each cell: did this choice have a seat for merit {formatNumber(merit!)}, and at what closing rank?</p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Choice</th>
                        {ROUNDS.map((r) => <th key={r} scope="col" className="num">{formatRound(r, "short")}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {result.grid.map((g) => (
                        <tr key={g.preference}>
                          <td className="num">{g.preference}</td>
                          <td>
                            <span className="sim-grid-college">{g.collegeName ?? `Unknown code ${g.choiceCode}`}</span>
                            <span className="sim-grid-branch">{g.branch ?? ""}</span>
                          </td>
                          {ROUNDS.map((r) => {
                            const seat = g.byRound[r];
                            const held = result.rounds.find((x) => x.round === r)?.preference === g.preference;
                            return (
                              <td key={r} className={`num sim-cell${held ? " held" : seat ? " open" : ""}`}>
                                {held && <span className="sr-only">Your seat: </span>}
                                <span className="sim-dot" aria-hidden="true" />
                                <span className="sim-val">{seat ? formatNumber(seat.closingMerit) : <span aria-label="no seat">—</span>}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="sim-legend">
                  <span className="sim-key held" /> your seat that round <span className="sim-key open" /> a seat was available, lower on your list or already passed
                </p>
              </section>

              {afterRoundI?.preference && !afterRoundI.frozen && (
                <section className="card sim-next" aria-label="After Round I">
                  <h2>After Round I, you could float</h2>
                  <p>
                    Choice {afterRoundI.preference} is outside the Round I freeze zone, so you could keep it and stay in line for{" "}
                    {afterRoundI.preference === 2 ? "choice 1" : `choices 1–${afterRoundI.preference - 1}`}.
                    See the <Link to="/allotment">After allotment</Link> step once your real allotment is out.
                  </p>
                </section>
              )}
              <PlanNextStep current="/simulator" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
