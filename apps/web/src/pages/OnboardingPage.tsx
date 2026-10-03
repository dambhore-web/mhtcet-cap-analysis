import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, generalOpen, BRANCH_GROUPS } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { CATEGORY_OPTIONS, FLAG_OPTIONS, MINORITY_OPTIONS } from "../lib/categories";
import { UNIVERSITIES } from "../lib/universities";
import { formatNumber } from "../lib/format";
import {
  EMPTY_ANSWERS,
  ewsAllowed,
  parseMerit,
  parsePercentile,
  toFindParams,
  toProfile,
  visibleSteps,
  type Answers,
  type StepId,
} from "../lib/onboarding";
import { Icon } from "../components/Icon";
import { MeritRuler } from "../components/MeritRuler";
import { usePageMeta } from "../lib/seo";
import "./OnboardingPage.css";

/**
 * A first answer at the merit step: every branch's general open closing rank as a barcode,
 * with the typed merit as the pin. Category and seat details come later, so this says so.
 */
function MeritPreview({ text, onChange }: { text: string; onChange: (merit: number) => void }) {
  const [vals, setVals] = useState<number[] | null>(null);
  useEffect(() => {
    let live = true;
    api.openLatest().then((r) => live && setVals(generalOpen(r.rows).map((x) => x[4]))).catch(() => live && setVals([]));
    return () => {
      live = false;
    };
  }, []);
  const merit = parseInt(text.replace(/\D/g, ""), 10);
  if (!vals || vals.length === 0 || !(merit > 0)) return null;
  const n = vals.filter((v) => merit <= v).length;
  return (
    <div className="ob-preview" aria-live="polite">
      <p className="ob-preview-verdict">
        <b>{formatNumber(n)}</b> branches took a merit of {formatNumber(merit)} or worse (open seats). Your category adds more.
      </p>
      <MeritRuler marks={vals.map((value) => ({ value }))} merit={merit} onMeritChange={onChange} barcode hint={null} ariaLabel="Every branch's closing rank, with your merit number" />
    </div>
  );
}

const SECTION: Record<StepId, string> = {
  exam: "About your exam",
  have: "About your exam",
  score: "About your exam",
  category: "Your seat details",
  gender: "Your seat details",
  university: "Your seat details",
  special: "Your seat details",
  minority: "Your seat details",
  branches: "What you're looking for",
};
const OPTIONAL: StepId[] = ["university", "special", "minority", "branches"];

/** /welcome/start: the student's details, one question per screen (#142). */
export function OnboardingWizard() {
  usePageMeta({ title: "Find your colleges", noindex: true });
  const { setProfile } = useProfile();
  const navigate = useNavigate();
  const [a, setA] = useState<Answers>(EMPTY_ANSWERS);
  const [stepId, setStepId] = useState<StepId>("exam");
  const [error, setError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps = visibleSteps(a);
  const index = Math.max(0, steps.indexOf(stepId));
  const last = index === steps.length - 1;

  const update = (patch: Partial<Answers>) => {
    setA((prev) => ({ ...prev, ...patch }));
    setError("");
  };

  // Move focus to the new question so screen readers announce it
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepId]);

  // A percentile is searched as it is: Find compares it with the closing percentiles on the lists
  const pct = a.have === "percentile" ? parsePercentile(a.percentile) : null;

  function validate(): string {
    if (stepId !== "score") return "";
    if (a.have === "merit") return parseMerit(a.merit) ? "" : `Enter your ${a.exam === "AI" ? "All India" : "state"} merit number, for example 12450.`;
    if (pct == null) return "Enter a percentile between 0 and 100, for example 96.82.";
    return "";
  }

  function finish(answers: Answers) {
    const params = toFindParams(answers);
    if (!params) {
      setStepId("score");
      return;
    }
    setProfile(toProfile(answers));
    navigate(`/find?${params.toString()}`);
  }

  function next(e?: React.FormEvent) {
    e?.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (last) finish(a);
    else setStepId(steps[index + 1]);
  }

  function back() {
    setError("");
    if (index === 0) navigate("/");
    else setStepId(steps[index - 1]);
  }

  /** "Skip", "None of these", "No preference": clear this step's answer and move on. */
  function skip() {
    const cleared: Partial<Answers> =
      stepId === "university" ? { homeUniversity: "" }
      : stepId === "special" ? { flags: { ...EMPTY_ANSWERS.flags } }
      : stepId === "minority" ? { minority: "" }
      : stepId === "branches" ? { branchGroups: [] }
      : {};
    const nextA = { ...a, ...cleared };
    setA(nextA);
    setError("");
    if (last) finish(nextA);
    else setStepId(steps[index + 1]);
  }

  const skipLabel = stepId === "special" ? "None of these" : stepId === "branches" ? "No preference" : "Skip";

  return (
    <div className="onboarding-page">
      <header className="ob-header">
        <Link to="/" className="ob-logo" aria-label="GetMeCollege home">
          <span className="ob-logo-mark" aria-hidden="true"><Icon name="compass" size={18} /></span>
          GetMeCollege
        </Link>
        <Link to="/colleges" className="btn btn-secondary btn-sm">Browse colleges<span className="ob-browse-more"> instead</span></Link>
      </header>

      <main className="ob-shell">
        <div className="ob-progress-wrap">
          <div className="ob-progress-text">
            <strong>Step {index + 1} of {steps.length}{OPTIONAL.includes(stepId) ? " · optional" : ""}</strong>
            <span>{SECTION[stepId]}</span>
          </div>
          <div className="ob-progress" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-hidden="true">
            {steps.map((s, i) => <span key={s} className={`ob-seg${i <= index ? " done" : ""}`} />)}
          </div>
        </div>

        <form className="ob-card" onSubmit={next} noValidate>
          {stepId === "exam" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>How are you applying?</h1>
              <p className="ob-lead">This decides which merit list and which seats we check.</p>
              <fieldset className="ob-choices">
                <legend className="sr-only">How are you applying?</legend>
                <Choice name="exam" checked={a.exam === "MH"} onChange={() => update({ exam: "MH" })}
                  title="MHT-CET" desc="State merit list · Maharashtra state-quota seats" />
                <Choice name="exam" checked={a.exam === "AI"} onChange={() => update({ exam: "AI" })}
                  title="JEE Main"
                  desc="Your All India merit number, from the CET Cell's All India merit list (not your JEE rank) · All India seats" />
              </fieldset>
            </>
          )}

          {stepId === "have" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>What do you have right now?</h1>
              <p className="ob-lead">
                Either works. Every CAP cutoff list prints both the merit number and the percentile of the last student admitted.
              </p>
              <fieldset className="ob-choices">
                <legend className="sr-only">What do you have right now?</legend>
                <Choice name="have" checked={a.have === "merit"} onChange={() => update({ have: "merit" })}
                  title={a.exam === "AI" ? "My All India merit number" : "My state merit number"}
                  desc={a.exam === "AI" ? "From the CET Cell's All India merit list" : "On your CAP login at the CET Cell portal, e.g. 12,450"} />
                <Choice name="have" checked={a.have === "percentile"} onChange={() => update({ have: "percentile" })}
                  title={a.exam === "AI" ? "Only my JEE Main percentile" : "Only my MHT-CET percentile"}
                  desc="Merit list not published yet, e.g. 96.82" />
              </fieldset>
            </>
          )}

          {stepId === "score" && a.have === "merit" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>What's your {a.exam === "AI" ? "All India" : "state"} merit number?</h1>
              <p className="ob-lead">
                {a.exam === "AI"
                  ? "Your position in the CET Cell's All India merit list. A smaller number is better."
                  : "Your position in the MHT-CET state merit list, not your percentile. A smaller number is better."}
              </p>
              <label className="ob-label" htmlFor="ob-merit">{a.exam === "AI" ? "All India merit number" : "State merit number"}</label>
              <div className={`ob-input-wrap${error ? " invalid" : ""}`}>
                <input id="ob-merit" className="ob-input" type="text" inputMode="numeric" placeholder="e.g. 12450" autoComplete="off"
                  value={a.merit} onChange={(e) => update({ merit: e.target.value })}
                  aria-invalid={!!error} aria-describedby={error ? "ob-error" : undefined} />
                <span className="ob-input-suffix">rank</span>
              </div>
              <p className="ob-hint">
                Don't have it yet?{" "}
                <button type="button" className="ob-link-btn" onClick={() => update({ have: "percentile" })}>Use your percentile instead</button>
              </p>
              {a.exam !== "AI" && <MeritPreview text={a.merit} onChange={(v) => update({ merit: String(v) })} />}
            </>
          )}

          {stepId === "score" && a.have === "percentile" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>What's your {a.exam === "AI" ? "JEE Main" : "MHT-CET"} percentile?</h1>
              {a.exam === "MH" && (
                <fieldset className="ob-toggle">
                  <legend className="ob-label">Subject group</legend>
                  {(["PCM", "PCB"] as const).map((g) => (
                    <label key={g} className={`ob-toggle-opt${a.subjectGroup === g ? " on" : ""}`}>
                      <input type="radio" name="subj" checked={a.subjectGroup === g} onChange={() => update({ subjectGroup: g })} />
                      {g}
                    </label>
                  ))}
                </fieldset>
              )}
              <label className="ob-label" htmlFor="ob-pct">Percentile</label>
              <div className={`ob-input-wrap${error ? " invalid" : ""}`}>
                <input id="ob-pct" className="ob-input" type="text" inputMode="decimal" placeholder="e.g. 96.82" autoComplete="off"
                  value={a.percentile} onChange={(e) => update({ percentile: e.target.value })}
                  aria-invalid={!!error} aria-describedby={error ? "ob-error" : undefined} />
                <span className="ob-input-suffix">percentile</span>
              </div>
              <p className="ob-hint">
                Every CAP cutoff list prints the percentile of the last student admitted. We compare yours with those,
                so you can see your options before the merit list is out.
              </p>
            </>
          )}

          {stepId === "category" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Which category are you in?</h1>
              <p className="ob-lead">As on your caste certificate. Open (general) seats are always included too.</p>
              <fieldset className="ob-grid ob-grid--3">
                <legend className="sr-only">Category</legend>
                {CATEGORY_OPTIONS.map((c) => (
                  <label key={c.label} className={`ob-tile${a.category === c.value ? " on" : ""}`}>
                    <input type="radio" name="category" checked={a.category === c.value}
                      onChange={() => update({ category: c.value, flags: c.value ? { ...a.flags, ews: false } : a.flags })} />
                    <strong>{c.label}</strong>
                    <span>{c.desc}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}

          {stepId === "gender" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Are you applying as a female candidate?</h1>
              <p className="ob-lead">Some seats are reserved for female candidates (the "L" seat types, such as LOPENS). We only use this to include them.</p>
              <fieldset className="ob-grid ob-grid--2">
                <legend className="sr-only">Gender</legend>
                <Choice name="gender" checked={a.gender === "F"} onChange={() => update({ gender: "F" })} title="Female" />
                <Choice name="gender" checked={a.gender === "M"} onChange={() => update({ gender: "M" })} title="Male" />
              </fieldset>
            </>
          )}

          {stepId === "university" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Which university area did you pass HSC (12th) in?</h1>
              <p className="ob-lead">
                Your home university is the university whose area your 12th-standard college is in. Colleges keep seats for students
                from their own university. If your CAP form shows a different home university, or you're not sure, pick "Not sure": we'll use
                state-level seats only.
              </p>
              <fieldset className="ob-list">
                <legend className="sr-only">Home university</legend>
                {UNIVERSITIES.map((u) => (
                  <label key={u} className={`ob-row${a.homeUniversity === u ? " on" : ""}`}>
                    <input type="radio" name="hu" checked={a.homeUniversity === u} onChange={() => update({ homeUniversity: u })} />
                    {u}
                  </label>
                ))}
                <label className={`ob-row${a.homeUniversity === "" ? " on" : ""}`}>
                  <input type="radio" name="hu" checked={a.homeUniversity === ""} onChange={() => update({ homeUniversity: "" })} />
                  Not sure / state level only
                </label>
              </fieldset>
            </>
          )}

          {stepId === "special" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Do any of these apply to you?</h1>
              <p className="ob-lead">
                Each one opens extra seats. Tick only what you can prove with a certificate. <Link to="/eligibility">What each one needs</Link>
              </p>
              <fieldset className="ob-list">
                <legend className="sr-only">Special seats</legend>
                {FLAG_OPTIONS.map(({ key, label, desc }) => {
                  const disabled = key === "ews" && !ewsAllowed(a);
                  return (
                    <label key={key} className={`ob-row ob-row--check${a.flags[key] && !disabled ? " on" : ""}${disabled ? " disabled" : ""}`}>
                      <input type="checkbox" checked={a.flags[key] && !disabled} disabled={disabled}
                        onChange={() => update({ flags: { ...a.flags, [key]: !a.flags[key] } })} />
                      <span className="ob-row-text">
                        <strong>{label}</strong>
                        <span>{disabled ? "Only for Open category, so EWS seats don't apply to you" : desc}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </>
          )}

          {stepId === "minority" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Are you from a minority community?</h1>
              <p className="ob-lead">
                Some CAP colleges are minority institutions and keep seats for their own community. You'll need a minority certificate
                (linguistic or religious) to claim them.
              </p>
              <fieldset className="ob-grid ob-grid--2">
                <legend className="sr-only">Minority community</legend>
                <label className={`ob-row ob-row--wide${a.minority === "" ? " on" : ""}`}>
                  <input type="radio" name="minority" checked={a.minority === ""} onChange={() => update({ minority: "" })} />
                  No, not from a minority community
                </label>
                {MINORITY_OPTIONS.map((m) => (
                  <label key={m.value} className={`ob-row${a.minority === m.value ? " on" : ""}`}>
                    <input type="radio" name="minority" checked={a.minority === m.value} onChange={() => update({ minority: m.value })} />
                    {m.label}
                  </label>
                ))}
              </fieldset>
            </>
          )}

          {stepId === "branches" && (
            <>
              <h1 ref={headingRef} tabIndex={-1}>Which branches interest you?</h1>
              <p className="ob-lead">Pick any. Your results open with these first, and one tap shows every branch. Nothing is hidden for good.</p>
              <fieldset className="ob-chips">
                <legend className="sr-only">Branch groups</legend>
                {BRANCH_GROUPS.map((g) => {
                  const on = a.branchGroups.includes(g);
                  return (
                    <label key={g} className={`ob-chip${on ? " on" : ""}`}>
                      <input type="checkbox" checked={on}
                        onChange={() => update({ branchGroups: on ? a.branchGroups.filter((x) => x !== g) : [...a.branchGroups, g] })} />
                      {on && <Icon name="check" size={14} />}
                      {g}
                    </label>
                  );
                })}
              </fieldset>
              <Summary a={a} />
            </>
          )}

          {error && <p id="ob-error" className="ob-error" role="alert">{error}</p>}

          <div className="ob-nav">
            <button type="button" className="btn btn-secondary" onClick={back}>
              <Icon name="back" size={18} />
              Back
            </button>
            <div className="ob-nav-right">
              {OPTIONAL.includes(stepId) && <button type="button" className="ob-link-btn" onClick={skip}>{skipLabel}</button>}
              <button type="submit" className={`btn ${last ? "btn-accent" : "btn-primary"}`}>
                {last ? "Show my colleges" : "Continue"}
                <Icon name="arrowRight" size={18} />
              </button>
            </div>
          </div>
        </form>
        <p className="ob-foot">Your answers stay on this device.</p>
      </main>
    </div>
  );
}

function Choice({ name, checked, onChange, title, desc }: { name: string; checked: boolean; onChange: () => void; title: string; desc?: string }) {
  return (
    <label className={`ob-choice${checked ? " on" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span className="ob-choice-text">
        <strong>{title}</strong>
        {desc && <span>{desc}</span>}
      </span>
    </label>
  );
}

/** Everything the student answered, shown before the search. */
function Summary({ a }: { a: Answers }) {
  const parts: string[] = [a.exam === "AI" ? "JEE Main (All India)" : "MHT-CET"];
  if (a.have === "merit" && parseMerit(a.merit)) parts.push(`Merit number ${formatNumber(parseMerit(a.merit)!)}`);
  if (a.have === "percentile" && parsePercentile(a.percentile)) parts.push(`Percentile ${a.percentile.trim()}`);
  if (a.exam === "MH") {
    parts.push(CATEGORY_OPTIONS.find((c) => c.value === a.category)?.label ?? "Open");
    parts.push(a.gender === "F" ? "Female" : "Male");
    parts.push(a.homeUniversity || "State level only");
    for (const f of FLAG_OPTIONS) if (a.flags[f.key] && (f.key !== "ews" || ewsAllowed(a))) parts.push(f.label);
    parts.push(a.minority ? MINORITY_OPTIONS.find((m) => m.value === a.minority)?.label ?? a.minority : "Not from a minority community");
  }
  return (
    <div className="ob-summary">
      <strong>Your answers</strong>
      <span>{parts.join(" · ")}</span>
    </div>
  );
}
