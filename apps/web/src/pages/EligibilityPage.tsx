import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { formatNumber } from "../lib/format";
import "./EligibilityPage.css";

type Flag = "ews" | "tfws" | "defence" | "pwd" | "orphan";

const SEATS: { key: Flag; title: string; codes: string; who: string; proof: string }[] = [
  {
    key: "tfws",
    title: "Tuition fee waiver (TFWS)",
    codes: "TFWS",
    who: "Maharashtra candidates whose family income is within the limit set for the year (₹8 lakh a year in recent brochures). The college waives tuition; you pay other fees.",
    proof: "Family income certificate for the previous financial year, from the competent authority.",
  },
  {
    key: "ews",
    title: "Economically weaker section (EWS)",
    codes: "EWS",
    who: "Candidates not covered by caste reservation whose family income and assets are within the EWS limits.",
    proof: "EWS eligibility certificate issued by the competent authority.",
  },
  {
    key: "defence",
    title: "Defence",
    codes: "DEF…",
    who: "Children of defence personnel and ex-servicemen, in the order of priority set in the brochure.",
    proof: "Defence certificate in the format given in the CAP information brochure.",
  },
  {
    key: "pwd",
    title: "Persons with disability (PWD)",
    codes: "PWD…",
    who: "Candidates with a benchmark disability (40% or more).",
    proof: "Disability certificate from a competent medical authority; the CET Cell may verify it.",
  },
  {
    key: "orphan",
    title: "Orphan",
    codes: "ORPHAN",
    who: "Candidates declared orphan under the state's rules.",
    proof: "Orphan certificate issued by the Women and Child Development Department.",
  },
];

const ALWAYS = [
  { title: "Home university (H) and other than home university (O)", body: "Some seats are kept for students who passed Class 12 from a college in the same university area. You don't tick this: add your home university in My details and Compass uses it." },
  { title: "Ladies seats (L…)", body: "Reserved for female candidates. Compass includes them automatically when your details say Female." },
  { title: "Category seats (OBC, SEBC, SC, ST, VJ/DT, NT-B, NT-C, NT-D)", body: "Used when your category is set in My details. You need a valid caste certificate and, where required, a validity certificate." },
];

/** Journey J6 (#82): "Do TFWS, EWS or Defence seats help me?" */
export function EligibilityPage() {
  const { profile, setProfile } = useProfile();
  const navigate = useNavigate();
  const [flags, setFlags] = useState<Record<Flag, boolean>>({ ews: profile.ews, tfws: profile.tfws, defence: profile.defence, pwd: profile.pwd, orphan: profile.orphan });
  const [counts, setCounts] = useState<{ base: number; withFlags: number } | null>(null);
  const merit = profile.meritNumber;

  useEffect(() => {
    if (!merit) return;
    let live = true;
    const req = (f: Record<Flag, boolean>) =>
      api.find({
        merit,
        homeUniversity: profile.homeUniversity || null,
        category: profile.category ?? null,
        gender: profile.gender,
        minorityCommunity: profile.minorityCommunity,
        flags: f,
        subjectGroup: profile.subjectGroup,
      });
    const none = { ews: false, tfws: false, defence: false, pwd: false, orphan: false };
    Promise.all([req(none), req(flags)])
      .then(([a, b]) => {
        const reach = (o: { status: string }[]) => o.filter((x) => x.status !== "out-of-range").length;
        if (live) setCounts({ base: reach(a.options), withFlags: reach(b.options) });
      })
      .catch(() => live && setCounts(null));
    return () => {
      live = false;
    };
  }, [merit, flags, profile.homeUniversity, profile.category, profile.gender, profile.subjectGroup]);

  const extra = counts ? counts.withFlags - counts.base : null;

  function apply() {
    setProfile({ ...profile, ...flags });
    navigate(merit ? `/?merit=${merit}` : "/");
  }

  return (
    <div className="page page--narrow eligibility-page">
      <PageHeader
        breadcrumb={[{ label: "Find colleges", to: "/" }, { label: "Which seats can I apply for?" }]}
        title="Which seats can you apply for?"
        subtitle="Besides general seats, CAP keeps seats for specific groups. Tick the ones that apply to you and Compass adds them to your results."
      />

      <fieldset className="elig-list">
        <legend className="sr-only">Special seat types</legend>
        {SEATS.map((s) => (
          <label key={s.key} className={`card elig-item${flags[s.key] ? " checked" : ""}`}>
            <input type="checkbox" checked={flags[s.key]} onChange={(e) => setFlags((f) => ({ ...f, [s.key]: e.target.checked }))} />
            <span className="elig-body">
              <span className="elig-title">
                {s.title} <code>{s.codes}</code>
              </span>
              <span className="elig-who">{s.who}</span>
              <span className="elig-proof"><strong>Proof:</strong> {s.proof}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="card elig-result" aria-live="polite">
        {merit ? (
          counts ? (
            <p>
              With what you've ticked, merit {formatNumber(merit)} reached <strong>{formatNumber(counts.withFlags)}</strong> branches last year
              {extra && extra > 0 ? <> — <strong>{formatNumber(extra)} more</strong> than with general seats alone.</> : "."}
            </p>
          ) : (
            <p>Counting branches…</p>
          )
        ) : (
          <p><Link to="/profile">Add your merit number</Link> to see how many branches these seats add.</p>
        )}
        <button type="button" className="btn btn-primary" onClick={apply}>
          <Icon name="check" size={18} />
          Save and update my results
        </button>
      </div>

      <section className="page-section" aria-labelledby="elig-always">
        <h2 id="elig-always" className="elig-h2">Used automatically from your details</h2>
        <ul className="elig-always">
          {ALWAYS.map((a) => (
            <li key={a.title}><strong>{a.title}.</strong> {a.body}</li>
          ))}
        </ul>
      </section>

      <p className="elig-note">
        Rules and certificate formats are set in the official CAP information brochure; the CET Cell's document check decides. Compass explains them.{" "}
        <Link to="/guide?tab=codes">Read the seat-code guide</Link> · <Link to="/ask">Ask Compass</Link>
      </p>
    </div>
  );
}
