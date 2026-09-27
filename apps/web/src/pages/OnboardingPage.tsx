import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import type { Category } from "../lib/api";
import type { Profile } from "../lib/profile";
import "./OnboardingPage.css";

const CATEGORIES: { value: Category | ""; label: string; desc: string }[] = [
  { value: "", label: "Open", desc: "General category" },
  { value: "SC", label: "SC", desc: "Scheduled Caste" },
  { value: "ST", label: "ST", desc: "Scheduled Tribe" },
  { value: "OBC", label: "OBC", desc: "Other Backward Class" },
  { value: "SEBC", label: "SEBC", desc: "Maratha / SEBC" },
  { value: "VJ", label: "VJ/DT", desc: "Vimukta Jati" },
  { value: "NT1", label: "NT-A", desc: "Nomadic Tribe A" },
  { value: "NT2", label: "NT-B", desc: "Nomadic Tribe B" },
  { value: "NT3", label: "NT-C", desc: "Nomadic Tribe C" },
];

const UNIVERSITIES = [
  "University of Mumbai",
  "Savitribai Phule Pune University",
  "Dr. Babasaheb Ambedkar Marathwada University",
  "Sant Gadge Baba Amravati University",
  "Rashtrasant Tukadoji Maharaj Nagpur University",
  "Swami Ramanand Teertha Marathwada University",
  "North Maharashtra University",
  "Dr. Babasaheb Ambedkar Technological University",
  "Solapur University",
  "Gondwana University",
];

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
    const raw = merit.replace(/,/g, "").trim();
    const profile: Profile = {
      meritNumber: parseInt(raw, 10),
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
        <div className="ob-logo">
          <span className="ob-logo-mark">↗</span>
          compass
        </div>
        <Link to="/colleges" className="ob-skip">Browse colleges →</Link>
      </header>

      <div className="ob-shell">
        <div className="ob-progress" aria-label={`Step ${step} of 3`}>
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className={`ob-pip${step >= s ? " done" : ""}${step === s ? " active" : ""}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="ob-card">
            <div className="ob-step-label">Step 1 of 3</div>
            <h1>What's your 2026 merit number?</h1>
            <p>
              This is your position in the MHT-CET state merit list — not your percentile. Find it on the official DTE Maharashtra portal.
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
              <span className="ob-input-suffix">MH</span>
            </div>
            {meritError && (
              <div id="ob-merit-err" className="ob-field-error" role="alert">{meritError}</div>
            )}
            <p className="ob-hint">Don't have it yet? You can set it later from Settings.</p>
            <button className="ob-next" onClick={handleStep1Next}>
              Continue →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="ob-card">
            <div className="ob-step-label">Step 2 of 3</div>
            <h1>Your category &amp; details</h1>
            <p>This helps Compass show only the seat types you're eligible for.</p>

            <div className="ob-label">Category</div>
            <div className="ob-category-grid" role="group" aria-label="Select category">
              {CATEGORIES.map((c) => (
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

            <div className="ob-label" style={{ marginBottom: "8px" }}>Subject group</div>
            <div className="ob-gender-row">
              {(["PCM", "PCB"] as const).map((sg) => (
                <label key={sg} className={`ob-gender-chip${subjectGroup === sg ? " active" : ""}`}>
                  <input type="radio" name="ob-subject" value={sg} checked={subjectGroup === sg} onChange={() => setSubjectGroup(sg)} />
                  {sg}
                </label>
              ))}
            </div>

            <div className="ob-btn-row">
              <button className="ob-back" onClick={() => setStep(1)}>← Back</button>
              <button className="ob-next" onClick={handleStep2Next}>Continue →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="ob-card">
            <div className="ob-step-label">Step 3 of 3</div>
            <h1>Almost done.</h1>
            <p>These are optional but improve eligibility matching.</p>

            <label className="ob-label" htmlFor="ob-uni">Home university</label>
            <select
              id="ob-uni"
              className="ob-select"
              value={homeUniversity}
              onChange={(e) => setHomeUniversity(e.target.value)}
            >
              <option value="">— Not sure / State Level only —</option>
              {UNIVERSITIES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <p className="ob-hint">
              This is the university your qualifying HSC college is affiliated with.
            </p>

            <div className="ob-label" style={{ marginBottom: "10px" }}>Special categories</div>
            <div className="ob-flags">
              {(Object.keys(flags) as (keyof typeof flags)[]).map((flag) => (
                <button
                  key={flag}
                  type="button"
                  className={`ob-flag${flags[flag] ? " active" : ""}`}
                  onClick={() => toggleFlag(flag)}
                  aria-pressed={flags[flag]}
                >
                  {flag.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="ob-btn-row">
              <button className="ob-back" onClick={() => setStep(2)}>← Back</button>
              <button className="ob-next ob-finish" onClick={handleFinish}>
                Start exploring →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
