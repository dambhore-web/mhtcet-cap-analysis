import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import type { Category } from "../lib/api";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { UNIVERSITIES } from "../lib/universities";
import type { Profile } from "../lib/profile";
import { FLAG_OPTIONS } from "../lib/categories";
import { Icon } from "../components/Icon";
import "./OnboardingPage.css";

type Step = 1 | 2 | 3;

export function OnboardingPage() {
  const { setProfile } = useProfile();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [merit, setMerit] = useState("");
  const [meritError, setMeritError] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [subjectGroup, setSubjectGroup] = useState<"PCM" | "PCB">("PCM");
  const [homeUniversity, setHomeUniversity] = useState("");
  const [flags, setFlags] = useState({ ews: false, tfws: false, defence: false, pwd: false, orphan: false });

  function toggleFlag(flag: keyof typeof flags) {
    setFlags((f) => ({ ...f, [flag]: !f[flag] }));
  }

  function handleStep1Next() {
    const raw = merit.replace(/,/g, "").trim();
    const num = parseInt(raw, 10);
    if (!raw || isNaN(num) || num < 1) {
      setMeritError("Enter a valid merit number (e.g. 12840).");
      return;
    }
    setMeritError("");
    setStep(2);
  }

  function handleStep2Next() {
    setStep(3);
  }

  function handleFinish() {
    const num = parseInt(merit.replace(/,/g, "").trim(), 10);
    const profile: Profile = {
      meritNumber: Number.isFinite(num) && num > 0 ? num : null,
      category: category || null,
      gender,
      subjectGroup,
      homeUniversity,
      ...flags,
    };
    setProfile(profile);
    navigate("/");
  }

  return (
    <div className="onboarding-page">
      <div className="ob-bg" aria-hidden="true" />

      <header className="ob-header">
        <Link to="/colleges" className="ob-logo" aria-label="Compass home">
          <span className="ob-logo-mark" aria-hidden="true"><Icon name="compass" size={18} /></span>
          Compass
        </Link>
        <Link to="/colleges" className="btn btn-ghost btn-sm">
          Browse colleges first
          <Icon name="arrowRight" size={16} />
        </Link>
      </header>

      <div className="ob-shell">
        <div className="ob-progress" role="img" aria-label={`Step ${step} of 3`}>
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className={`ob-pip${step >= s ? " done" : ""}${step === s ? " active" : ""}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="ob-card">
            <div className="ob-step-label">Step 1 of 3</div>
            <h1>What's your state merit number?</h1>
            <p>
              Your rank in the MHT-CET state merit list (not your percentile). It is on your CAP login at the CET Cell portal.
            </p>
            <label className="ob-label" htmlFor="ob-merit">
              State merit number
            </label>
            <div className={`ob-input-wrap${meritError ? " invalid" : ""}`}>
              <input
                id="ob-merit"
                type="text"
                inputMode="numeric"
                className="ob-input"
                placeholder="e.g. 12840"
                value={merit}
                onChange={(e) => {
                  setMerit(e.target.value);
                  setMeritError("");
                }}
                autoFocus
                aria-describedby={meritError ? "ob-merit-err" : undefined}
                aria-invalid={!!meritError}
              />
              <span className="ob-input-suffix">rank</span>
            </div>
            {meritError && (
              <div id="ob-merit-err" className="ob-field-error" role="alert">{meritError}</div>
            )}
            <p className="ob-hint">
              Merit list not out yet? <Link to="/estimate">Estimate it from your percentile</Link>, or{" "}
              <button type="button" className="ob-link-btn" onClick={() => { setMerit(""); setMeritError(""); setStep(2); }}>
                skip and add it later
              </button>.
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={handleStep1Next}>
              Continue
              <Icon name="arrowRight" size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="ob-card">
            <div className="ob-step-label">Step 2 of 3</div>
            <h1>Your category and details</h1>
            <p>Compass uses these to show only the seat types you are eligible for.</p>

            <div className="ob-label">Category</div>
            <div className="ob-category-grid" role="group" aria-label="Select category">
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`ob-cat-chip${category === c.value ? " active" : ""}`}
                  onClick={() => setCategory(c.value)}
                  aria-pressed={category === c.value}
                >
                  <span className="cat-label">{c.label}</span>
                  <span className="cat-desc">{c.desc}</span>
                </button>
              ))}
            </div>

            <fieldset className="ob-gender-group">
              <legend className="ob-label">Gender</legend>
              <div className="ob-gender-row">
                {(["M", "F"] as const).map((g) => (
                  <label key={g} className={`ob-gender-chip${gender === g ? " active" : ""}`}>
                    <input type="radio" name="ob-gender" value={g} checked={gender === g} onChange={() => setGender(g)} />
                    {g === "M" ? "Male" : "Female"}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="ob-label">Subject group</div>
            <div className="ob-gender-row">
              {(["PCM", "PCB"] as const).map((sg) => (
                <label key={sg} className={`ob-gender-chip${subjectGroup === sg ? " active" : ""}`}>
                  <input type="radio" name="ob-subject" value={sg} checked={subjectGroup === sg} onChange={() => setSubjectGroup(sg)} />
                  {sg}
                </label>
              ))}
            </div>

            <div className="ob-btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                <Icon name="back" size={18} />
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={handleStep2Next}>
                Continue
                <Icon name="arrowRight" size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="ob-card">
            <div className="ob-step-label">Step 3 of 3</div>
            <h1>Almost done</h1>
            <p>Optional, but these unlock home-university and special seats you may qualify for.</p>

            <label className="ob-label" htmlFor="ob-uni">Home university</label>
            <select
              id="ob-uni"
              className="ob-select"
              value={homeUniversity}
              onChange={(e) => setHomeUniversity(e.target.value)}
            >
              <option value="">Not sure / state level only</option>
              {UNIVERSITIES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <p className="ob-hint">
              This is the university your qualifying HSC college is affiliated with.
            </p>

            <div className="ob-label">Special categories (optional)</div>
            <div className="ob-flags">
              {FLAG_OPTIONS.map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  className={`ob-flag${flags[key] ? " active" : ""}`}
                  onClick={() => toggleFlag(key)}
                  aria-pressed={flags[key]}
                  title={desc}
                >
                  {flags[key] && <Icon name="check" size={14} />}
                  {label}
                </button>
              ))}
            </div>

            <div className="ob-btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                <Icon name="back" size={18} />
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={handleFinish}>
                See my options
                <Icon name="arrowRight" size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
