import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { loadList, type ListItem } from "../lib/list";
import "./AllotmentPage.css";

type Round = 1 | 2 | 3;

const FREEZE_ZONE: Record<Round, number> = { 1: 1, 2: 3, 3: 6 };

function getRank(items: ListItem[], choiceCode: string): number | null {
  const idx = items.findIndex((i) => i.choiceCode === choiceCode.trim().toUpperCase());
  return idx === -1 ? null : idx + 1;
}

export function AllotmentPage() {
  const [round, setRound] = useState<Round>(1);
  const [code, setCode] = useState("");
  const items = useMemo(() => loadList(), []);

  const rank = code.trim() ? getRank(items, code) : null;
  const allottedItem = rank !== null ? items[rank - 1] : null;
  const freezeZone = FREEZE_ZONE[round];
  const hasHigherOptions = rank !== null && rank > 1;
  const inFreezeZone = rank !== null && rank <= freezeZone;

  function Decision() {
    if (rank === null && code.trim()) {
      return (
        <div className="allot-not-found">
          <strong>{code.trim().toUpperCase()}</strong> is not in your saved list.{" "}
          <Link to="/list">Check your list →</Link>
        </div>
      );
    }
    if (rank === null) return null;

    if (rank === 1) {
      return (
        <div className="allot-decision allot-decision-freeze">
          <span className="allot-dec-badge">Freeze</span>
          <p>You got your <strong>#1 choice</strong>. Freeze immediately — there's nothing better on your list to upgrade to.</p>
        </div>
      );
    }

    if (round === 3) {
      return (
        <div className="allot-decision allot-decision-slide">
          <span className="allot-dec-badge">Slide or Freeze</span>
          <p>Round III is the last round. You can <strong>Slide</strong> to try for a better branch at the same college, or <strong>Freeze</strong> your current seat. Floating is no longer available.</p>
        </div>
      );
    }

    if (inFreezeZone) {
      return (
        <div className="allot-decision allot-decision-float">
          <span className="allot-dec-badge">Float</span>
          <p>
            You got <strong>#{rank}</strong> from your list. There {rank - 1 === 1 ? "is" : "are"} <strong>{rank - 1} option{rank - 1 !== 1 ? "s" : ""}</strong> ranked higher. Float to try for them in Round {round + 1} — you keep this seat as a fallback if nothing better comes through.
          </p>
        </div>
      );
    }

    return (
      <div className="allot-decision allot-decision-float">
        <span className="allot-dec-badge">Float</span>
        <p>You got <strong>#{rank}</strong> from your list. Float to Round {round + 1} to try for your top {rank - 1} option{rank - 1 !== 1 ? "s" : ""}. Your current seat is held as a fallback.</p>
      </div>
    );
  }

  return (
    <div className="allotment-page">
      <div className="allotment-content">

        <header className="allot-header">
          <h1>After your allotment</h1>
          <p>Enter what you got, and we'll tell you what to do next.</p>
        </header>

        {/* Round selector */}
        <div className="allot-section">
          <label className="allot-label">Which round is this?</label>
          <div className="allot-round-btns">
            {([1, 2, 3] as Round[]).map((r) => (
              <button
                key={r}
                className={`allot-round-btn${round === r ? " active" : ""}`}
                onClick={() => setRound(r)}
              >
                Round {["I", "II", "III"][r - 1]}
              </button>
            ))}
          </div>
        </div>

        {/* Code input */}
        <div className="allot-section">
          <label className="allot-label" htmlFor="allot-code">What choice code were you allotted?</label>
          <input
            id="allot-code"
            type="text"
            className="allot-code-input"
            placeholder="e.g. 110710510"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {allottedItem && (
            <div className="allot-found-item">
              <span className="allot-found-rank">#{rank}</span>
              <div className="allot-found-detail">
                <span className="allot-found-college">{allottedItem.collegeName}</span>
                <span className="allot-found-branch">{allottedItem.branch} · {allottedItem.seatType}</span>
              </div>
            </div>
          )}
        </div>

        {/* Decision */}
        <Decision />

        {/* Options grid */}
        <div className="allot-options">

          <div className={`allot-option-card allot-option-freeze${rank === 1 ? " allot-option-recommended" : ""}`}>
            <div className="allot-opt-head">
              <span className="allot-opt-icon allot-opt-icon-freeze">❄</span>
              <div>
                <h3>Freeze</h3>
                {rank === 1 && <span className="allot-rec-tag">Recommended</span>}
              </div>
            </div>
            <p>Accept your allotment permanently. You're done with CAP — go to the reporting centre to confirm your seat.</p>
            <ul className="allot-opt-list">
              <li>Safe choice — seat is guaranteed</li>
              <li>No more upgrades possible after this</li>
              <li>Required before reporting centre deadline</li>
            </ul>
          </div>

          <div className={`allot-option-card allot-option-float${hasHigherOptions && round < 3 ? " allot-option-recommended" : ""}${round === 3 ? " allot-option-disabled" : ""}`}>
            <div className="allot-opt-head">
              <span className="allot-opt-icon allot-opt-icon-float">↑</span>
              <div>
                <h3>Float</h3>
                {hasHigherOptions && round < 3 && <span className="allot-rec-tag">Recommended</span>}
                {round === 3 && <span className="allot-unavail-tag">Not available in Round III</span>}
              </div>
            </div>
            <p>Stay in the next round for a chance at a better option from your list. Your current seat is held if no upgrade comes.</p>
            <ul className="allot-opt-list">
              <li>Current seat is your fallback — no risk of losing it</li>
              <li>System automatically upgrades if a higher-ranked option opens</li>
              <li>You can freeze any time during the next round</li>
            </ul>
          </div>

          <div className={`allot-option-card allot-option-slide${round === 3 && hasHigherOptions ? " allot-option-recommended" : ""}`}>
            <div className="allot-opt-head">
              <span className="allot-opt-icon allot-opt-icon-slide">↓</span>
              <div>
                <h3>Slide</h3>
                {round === 3 && hasHigherOptions && <span className="allot-rec-tag">Consider if same college</span>}
              </div>
            </div>
            <p>Like Float, but only upgrades within the <strong>same college and branch</strong>. Useful if you want the college but a better seat type (e.g. GOPENS instead of GOBC).</p>
            <ul className="allot-opt-list">
              <li>Same-college upgrades only — won't move you to a different college</li>
              <li>Safer than Float if you're happy with the college</li>
              <li>Available in all rounds</li>
            </ul>
          </div>

        </div>

        {/* Auto-freeze reminder */}
        <div className="allot-freeze-reminder">
          <div className="allot-reminder-head">
            <span className="allot-reminder-icon">⚠</span>
            <strong>Auto-freeze rule for Round {["I", "II", "III"][round - 1]}</strong>
          </div>
          <p>
            {round === 1 && "If you ranked this option #1 and it was allotted, the system auto-freezes it. You cannot float from your top choice."}
            {round === 2 && "Options you ranked #1–3 are auto-frozen in Round II. If allotted within ranks 1–3, the system freezes automatically."}
            {round === 3 && "Options you ranked #1–6 are auto-frozen in Round III. If allotted within ranks 1–6, the system freezes automatically."}
          </p>
          <Link to="/guide" className="allot-guide-link">Read the full guide →</Link>
        </div>

        {/* No list state */}
        {items.length === 0 && (
          <div className="allot-no-list">
            <p>You don't have a saved list yet. Build your shortlist to get personalised advice here.</p>
            <Link to="/" className="allot-no-list-cta">Find colleges →</Link>
          </div>
        )}

      </div>
    </div>
  );
}
