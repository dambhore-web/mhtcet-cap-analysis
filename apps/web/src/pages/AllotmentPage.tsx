import { Link } from "react-router-dom";
import { AUTO_FREEZE_TOP_N, type Round } from "@mhtcet/core";
import { useList } from "../lib/list";
import { useProfile } from "../lib/ProfileContext";
import { analyseAllotment, saveAllotment, useAllotment, type Advice } from "../lib/allotment";
import { PageHeader } from "../components/PageHeader";
import { PlanNextStep, PlanSubnav } from "../components/PlanSubnav";
import { Icon, type IconName } from "../components/Icon";
import { formatNumber, formatRound } from "../lib/format";
import { seatTypeShortLabel } from "../lib/seatType";
import { decidedOn, markDecided, useProgress } from "../lib/progress";
import "./AllotmentPage.css";

const ROUNDS: Round[] = ["I", "II", "III", "IV"];

const HEADLINE: Record<Advice, string> = {
  frozen: "This seat is frozen automatically",
  final: "Round IV allotments are final",
  freeze: "Freeze looks right",
  float: "Float is worth considering",
  slide: "Slide is worth considering",
};

const CHOICES: { id: "freeze" | "float" | "slide"; title: string; icon: IconName; body: string }[] = [
  { id: "freeze", title: "Freeze", icon: "lock", body: "Accept this seat and stop. You won't be considered for any higher choice again. Report to the college with your documents." },
  { id: "float", title: "Float (betterment)", icon: "arrowUp", body: "Accept this seat and stay in line for your higher choices at any college. If one opens in a later round you move up; if not, you keep this seat." },
  { id: "slide", title: "Slide", icon: "arrowRight", body: "Accept this seat and stay in line only for higher choices at the same college. You never move to another college." },
];

/** My CAP plan step 4, journey J10: "I got a seat. Freeze or float?" */
export function AllotmentPage() {
  const items = useList();
  const { profile } = useProfile();
  const allotment = useAllotment();
  const progress = useProgress();
  const decided = decidedOn(progress, allotment);
  const merit = profile.meritNumber;
  const round = allotment?.round ?? "I";
  const analysis = allotment ? analyseAllotment(items, allotment, merit) : null;

  const recommended = analysis?.advice === "float" || analysis?.advice === "slide" || analysis?.advice === "freeze" ? analysis.advice : null;

  return (
    <div className="page allotment-page">
      <PageHeader
        breadcrumb={[{ label: "My CAP plan", to: "/list" }, { label: "After allotment" }]}
        title="After your allotment"
        subtitle="Tell Compass which seat you were allotted. It shows which of your higher choices opened up last year, and what each of your three choices means."
      />
      <PlanSubnav />

      {items.length === 0 ? (
        <div className="empty-state">
          <Icon name="list" size={28} className="empty-state-icon" />
          <h2>Add your option form first</h2>
          <p>Compass compares your allotted seat with the choices above it on your option form.</p>
          <Link to="/list" className="btn btn-primary">Go to option form</Link>
        </div>
      ) : (
        <div className="allot-layout">
          <section className="card allot-input" aria-labelledby="allot-input-title">
            <h2 id="allot-input-title" className="label">Your allotment</h2>
            <fieldset className="allot-rounds">
              <legend className="allot-legend">Round</legend>
              {ROUNDS.map((r) => (
                <label key={r} className={`allot-round${round === r ? " active" : ""}`}>
                  <input type="radio" name="allot-round" checked={round === r} onChange={() => saveAllotment({ round: r, choiceCode: allotment?.choiceCode ?? "" })} />
                  {formatRound(r)}
                </label>
              ))}
            </fieldset>
            <label className="allot-legend" htmlFor="allot-seat">Seat you were allotted</label>
            <select
              id="allot-seat"
              className="allot-select"
              value={allotment?.choiceCode ?? ""}
              onChange={(e) => saveAllotment(e.target.value ? { round, choiceCode: e.target.value } : null)}
            >
              <option value="">Choose from your option form…</option>
              {items.map((it, i) => (
                <option key={it.id} value={it.choiceCode}>
                  {i + 1}. {it.collegeName} · {it.branch} ({it.choiceCode})
                </option>
              ))}
            </select>
            <p className="allot-hint">Not on your list? Check the choice code on your allotment letter and <Link to="/list">your option form</Link>.</p>
          </section>

          {analysis ? (
            <>
              <section className={`card allot-verdict allot-verdict--${analysis.advice}`} aria-live="polite">
                <p className="label">{formatRound(round)} · choice {analysis.preference} on your list</p>
                <h2>{HEADLINE[analysis.advice]}</h2>
                <p className="allot-seat">
                  {analysis.item.collegeName} · {analysis.item.branch} · {seatTypeShortLabel(analysis.item.seatType)}
                </p>
                <p>
                  {analysis.advice === "frozen" &&
                    `Choice ${analysis.preference} is inside the ${formatRound(round)} auto-freeze zone (choices 1–${AUTO_FREEZE_TOP_N[round]}). CAP locks this seat: accept it and report to the college.`}
                  {analysis.advice === "final" && "There is no later CAP round to move up in. Accept the seat and report to the college, or leave it."}
                  {analysis.advice === "freeze" &&
                    (analysis.preference === 1
                      ? "You got your first choice, so there is nothing higher to wait for."
                      : "None of the choices above this one admitted your merit number in any round last year, so waiting is unlikely to help.")}
                  {analysis.advice === "float" &&
                    `${analysis.higher.filter((h) => h.openedLastYear).length} of the ${analysis.higher.length} choices above this seat admitted your merit number by the last round last year. Float keeps this seat and keeps you in line for them.`}
                  {analysis.advice === "slide" &&
                    "The higher choices that opened up last year are all at this college, so Slide keeps you in line for them without risking a move to another college."}
                </p>
                <p className="allot-caveat">Based on last year's closing ranks. This year will differ. The decision and the submission on the CET Cell portal are yours.</p>
              </section>

              {analysis.higher.length > 0 && (
                <section className="card allot-higher" aria-labelledby="allot-higher-title">
                  <h2 id="allot-higher-title" className="label">Choices above your seat, last year</h2>
                  <ol className="allot-higher-list">
                    {analysis.higher.map((h) => (
                      <li key={h.item.id}>
                        <span className="allot-pref">{h.preference}</span>
                        <span className="allot-higher-name">
                          <strong>{h.item.collegeName}</strong>
                          <span>{h.item.branch}</span>
                        </span>
                        <span className="allot-higher-rank">
                          last round {formatNumber(h.item.lastRoundClosing ?? h.item.closingMerit)}
                        </span>
                        {h.openedLastYear == null ? null : h.openedLastYear ? (
                          <span className="badge badge-later"><Icon name="clock" size={12} />Opened for you</span>
                        ) : (
                          <span className="badge badge-out"><Icon name="minus" size={12} />Never reached you</span>
                        )}
                      </li>
                    ))}
                  </ol>
                  {!merit && <p className="allot-hint"><Link to="/profile/details">Add your merit number</Link> to see which of these opened up for you.</p>}
                </section>
              )}
            </>
          ) : allotment?.choiceCode ? (
            <div className="empty-state" role="alert">
              <p>That seat isn't on your option form. <Link to="/list">Check your option form</Link>.</p>
            </div>
          ) : null}

          <section className="allot-choices" aria-label="Your three choices">
            {CHOICES.map((c) => {
              const unavailable = analysis && (analysis.advice === "frozen" || analysis.advice === "final") && c.id !== "freeze";
              return (
                <article key={c.id} className={`card allot-choice${recommended === c.id ? " recommended" : ""}${unavailable ? " unavailable" : ""}`}>
                  <h3>
                    <Icon name={c.icon} size={18} />
                    {c.title}
                    {recommended === c.id && <span className="badge badge-safe">Suggested</span>}
                    {unavailable && <span className="badge badge-out">Not available for this seat</span>}
                  </h3>
                  <p>{c.body}</p>
                </article>
              );
            })}
          </section>

          {analysis && (
            <div className="allot-decided">
              <button type="button" className={`btn ${decided ? "btn-secondary" : "btn-primary"}`} aria-pressed={decided} onClick={() => markDecided(decided ? null : allotment)}>
                <Icon name={decided ? "check" : "steps"} size={16} />
                {decided ? "Choice made on the CET Cell portal" : "I've made my choice on the CET Cell portal"}
              </button>
              <p className="allot-hint">
                {decided ? "Tap again if you haven't. Your next step is the family summary." : "Mark it once you have chosen freeze, float or slide on the portal. Nothing is sent anywhere."}
              </p>
            </div>
          )}

          <section className="card allot-checklist" aria-labelledby="allot-checklist-title">
            <h2 id="allot-checklist-title" className="label">Before you accept</h2>
            <ul>
              <li>Pay the seat acceptance fee shown on the CET Cell portal before the deadline.</li>
              <li>Keep your documents ready for reporting (the list is on the CET Cell portal).</li>
              <li>Share the plan with your family: <Link to="/summary">family summary</Link>.</li>
            </ul>
            <p className="allot-hint"><Link to="/guide?tab=freeze">How freeze, float and slide work</Link> · <Link to="/ask">Ask Compass about your allotment</Link></p>
          </section>
          <PlanNextStep current="/allotment" />
        </div>
      )}
    </div>
  );
}
