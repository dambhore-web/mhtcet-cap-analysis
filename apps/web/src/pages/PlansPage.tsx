import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { PLANS, formatInr } from "../lib/plans";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import "./PlansPage.css";

export function PlansPage() {
  const { user } = useAuth();
  const isPaid = user?.plan === "paid";
  const { free, seasonPass } = PLANS;

  return (
    <div className="page plans-page">
      <PageHeader
        breadcrumb={[{ label: "Account", to: "/profile" }, { label: "Plans" }]}
        title="Plans"
        subtitle={`Finding colleges is free. The ${seasonPass.name} adds the simulator and unlimited questions, for one payment covering the ${seasonPass.validity}.`}
      />

      <div className="plans-grid">
        <section className="plan-card card" aria-labelledby="plan-free">
          <div className="plan-card-head">
            <h2 id="plan-free" className="plan-name">{free.name}</h2>
            {!isPaid && <span className="badge badge-sample">Your plan</span>}
          </div>
          <p className="plan-price">{formatInr(free.priceInr)}</p>
          <ul className="plan-features">
            {free.features.map((f) => (
              <li key={f}><Icon name="check" size={16} />{f}</li>
            ))}
            <li><Icon name="check" size={16} />Ask Compass: {free.askQuestions} questions</li>
          </ul>
          <Link to="/find" className="btn btn-secondary btn-block">Find my options</Link>
        </section>

        <section className={`plan-card plan-card--pro card${isPaid ? " active" : ""}`} aria-labelledby="plan-pro">
          <div className="plan-card-head">
            <h2 id="plan-pro" className="plan-name">{seasonPass.name}</h2>
            {isPaid && <span className="badge badge-safe"><Icon name="check" size={12} />Active</span>}
          </div>
          <p className="plan-price">
            {formatInr(seasonPass.priceInr)} <span className="plan-price-note">one payment</span>
          </p>
          <p className="plan-validity">Valid for the {seasonPass.validity}</p>
          <ul className="plan-features">
            {seasonPass.features.map((f) => (
              <li key={f}><Icon name="check" size={16} />{f}</li>
            ))}
          </ul>
          {isPaid ? (
            <p className="plan-active-msg">You're all set for this CAP season.</p>
          ) : (
            <button type="button" className="btn btn-primary btn-block" disabled aria-describedby="plan-soon">
              Get {seasonPass.name}
            </button>
          )}
          {!isPaid && (
            <p id="plan-soon" className="plan-soon">
              Payments open soon.{seasonPass.priceIsProvisional ? " Price may change before launch." : ""}
            </p>
          )}
        </section>
      </div>

      <div className="plans-note">
        <p>Payments will be handled by a secure payment provider, with a GST invoice and a 7-day refund if the pass is unused.</p>
        <p><Link to="/legal?tab=terms">Terms</Link> · <Link to="/legal?tab=privacy">Privacy</Link></p>
      </div>
    </div>
  );
}
