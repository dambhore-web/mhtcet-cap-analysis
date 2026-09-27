import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import "./PlansPage.css";

const FEATURES_FREE = [
  "Rank finder — unlimited searches",
  "Browse all 387 colleges",
  "College cutoff pages (all rounds)",
  "Save up to 50 preferences",
  "Compare up to 3 colleges",
  "Shareable result links",
  "Parent summary PDF",
];

const FEATURES_PRO = [
  "Everything in Free",
  "AI admissions assistant (unlimited questions)",
  "CAP round simulator — see where you land Round I–IV",
  "Freeze / Float / Slide advisor",
  "Priority support via WhatsApp",
];

export function PlansPage() {
  const { user } = useAuth();
  const isPaid = user?.plan === "paid";

  return (
    <div className="plans-page">
      <header className="plans-header">
        <Link to="/profile" className="plans-back">←</Link>
        <div className="plans-header-text">
          <h1>Upgrade Compass</h1>
          <p>One-time season pass. Valid for 2026–27 admissions cycle.</p>
        </div>
      </header>

      <div className="plans-body">
        {/* Free plan */}
        <div className="plan-card free">
          <div className="plan-card-head">
            <span className="plan-name">Free</span>
            {!isPaid && <span className="plan-current-badge">Current plan</span>}
            <span className="plan-price">₹ 0</span>
          </div>
          <ul className="plan-features">
            {FEATURES_FREE.map((f) => (
              <li key={f}><span className="pf-check">✓</span>{f}</li>
            ))}
          </ul>
        </div>

        {/* Pro plan */}
        <div className={`plan-card pro${isPaid ? " active" : ""}`}>
          <div className="plan-card-head">
            <span className="plan-name">Season Pass</span>
            {isPaid && <span className="plan-current-badge pro">Active ✓</span>}
            <span className="plan-price">₹ 299 <span className="plan-price-note">one-time</span></span>
          </div>
          <ul className="plan-features">
            {FEATURES_PRO.map((f) => (
              <li key={f} className="pro-feature"><span className="pf-check pro">✓</span>{f}</li>
            ))}
          </ul>
          {!isPaid && (
            <button className="plan-cta" onClick={() => alert("Payments launch October 2026. Come back then!")}>
              Get Season Pass — ₹ 299
            </button>
          )}
          {isPaid && (
            <div className="plan-active-msg">You're all set for the 2026–27 season.</div>
          )}
        </div>

        <div className="plans-note">
          <p>
            Payments via Razorpay. GST invoice issued automatically.{" "}
            <strong>7-day refund policy</strong> if unused.
          </p>
          <p>
            Season pass valid for the entire 2026–27 MHT-CET CAP cycle (Rounds I–IV + ARC).
          </p>
          <Link to="/legal" className="plans-legal-link">Disclaimer · Terms · Privacy</Link>
        </div>
      </div>
    </div>
  );
}
