import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import type { Category } from "../lib/api";
import { CATEGORY_OPTIONS, MINORITY_OPTIONS } from "../lib/categories";
import { UNIVERSITIES } from "../lib/universities";
import type { Profile } from "../lib/profile";
import { FLAG_OPTIONS } from "../lib/categories";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import "./ProfilePage.css";

export function ProfilePage() {
  const { profile, setProfile, resetProfile, hasProfile } = useProfile();
  const navigate = useNavigate();

  const [merit, setMerit] = useState(profile.meritNumber ? String(profile.meritNumber) : "");
  const [category, setCategory] = useState<Category | "">(profile.category ?? "");
  const [gender, setGender] = useState<"M" | "F">(profile.gender);
  const [subjectGroup, setSubjectGroup] = useState<"PCM" | "PCB">(profile.subjectGroup);
  const [homeUniversity, setHomeUniversity] = useState(profile.homeUniversity);
  const [flags, setFlags] = useState({
    ews: profile.ews,
    tfws: profile.tfws,
    defence: profile.defence,
    pwd: profile.pwd,
    orphan: profile.orphan,
  });
  const [minority, setMinority] = useState(profile.minorityCommunity ?? "");
  const [meritError, setMeritError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggleFlag(flag: keyof typeof flags) {
    setFlags((f) => ({ ...f, [flag]: !f[flag] }));
  }

  function handleSave() {
    // EWS is only for Open-category candidates
    const details = { ...flags, ews: flags.ews && !category, minorityCommunity: minority || null };
    const raw = merit.replace(/,/g, "").trim();
    if (raw) {
      const num = parseInt(raw, 10);
      if (isNaN(num) || num < 1) { setMeritError("Enter a valid merit number."); return; }
      setMeritError("");
      const p: Profile = { meritNumber: num, category: category || null, gender, subjectGroup, homeUniversity, ...details };
      setProfile(p);
    } else {
      const p: Profile = { meritNumber: null, category: category || null, gender, subjectGroup, homeUniversity, ...details };
      setProfile(p);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    if (!confirm("Clear your saved details? You'll need to enter your merit number again.")) return;
    resetProfile();
    navigate("/welcome");
  }

  return (
    <div className="page page--narrow profile-page">
      <PageHeader
        title="My details"
        subtitle="Used to match you to the seat types you are eligible for. Saved only in this browser."
      />

      <div className="profile-body card">
        <section className="profile-section">
          <label className="profile-label" htmlFor="merit-input">State merit number</label>
          <div className={`profile-input-wrap${meritError ? " invalid" : ""}`}>
            <input
              id="merit-input"
              type="text"
              inputMode="numeric"
              className="profile-input"
              placeholder="e.g. 12840"
              value={merit}
              onChange={(e) => { setMerit(e.target.value); setMeritError(""); setSaved(false); }}
            />
            <span className="profile-input-suffix">rank</span>
          </div>
          {meritError && <div className="profile-field-error">{meritError}</div>}
          {!hasProfile && <p className="profile-hint">No merit number yet? <Link to="/estimate">Estimate it from your percentile</Link>.</p>}
        </section>

        <section className="profile-section">
          <div className="profile-label">Category</div>
          <div className="profile-cat-grid">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`profile-cat-chip${category === c.value ? " active" : ""}`}
                onClick={() => { setCategory(c.value); setSaved(false); }}
                aria-pressed={category === c.value}
              >
                <span>{c.label}</span>
                <span className="cat-sub">{c.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-label">Gender</div>
          <div className="profile-chips-row">
            {(["M", "F"] as const).map((g) => (
              <label key={g} className={`profile-chip${gender === g ? " active" : ""}`}>
                <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => { setGender(g); setSaved(false); }} />
                {g === "M" ? "Male" : "Female"}
              </label>
            ))}
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-label">Subject group</div>
          <div className="profile-chips-row">
            {(["PCM", "PCB"] as const).map((sg) => (
              <label key={sg} className={`profile-chip${subjectGroup === sg ? " active" : ""}`}>
                <input type="radio" name="subjectGroup" value={sg} checked={subjectGroup === sg} onChange={() => { setSubjectGroup(sg); setSaved(false); }} />
                {sg}
              </label>
            ))}
          </div>
        </section>

        <section className="profile-section">
          <label className="profile-label" htmlFor="uni-select">Home university</label>
          <select
            id="uni-select"
            className="profile-select"
            value={homeUniversity}
            onChange={(e) => { setHomeUniversity(e.target.value); setSaved(false); }}
          >
            <option value="">Not sure / state level only</option>
            {UNIVERSITIES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </section>

        <section className="profile-section">
          <div className="profile-label">Special categories</div>
          <div className="profile-flags-row">
            {FLAG_OPTIONS.filter(({ key }) => key !== "ews" || !category).map(({ key, label, desc }) => (
              <button
                key={key}
                type="button"
                className={`profile-flag${flags[key] ? " active" : ""}`}
                onClick={() => { toggleFlag(key); setSaved(false); }}
                aria-pressed={flags[key]}
                title={desc}
              >
                {flags[key] && <Icon name="check" size={14} />}
                {label}
              </button>
            ))}
          </div>
          {category && <p className="profile-hint">EWS is only for Open category, so it isn't shown.</p>}
        </section>

        <section className="profile-section">
          <label className="profile-label" htmlFor="minority-select">Minority community</label>
          <select
            id="minority-select"
            className="profile-select"
            value={minority}
            onChange={(e) => { setMinority(e.target.value); setSaved(false); }}
          >
            <option value="">Not from a minority community</option>
            {MINORITY_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <p className="profile-hint">Minority colleges keep some seats for their own community. You need a minority certificate to claim them.</p>
        </section>

        <div className="profile-actions">
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            {saved && <Icon name="check" size={18} />}
            {saved ? "Saved" : "Save details"}
          </button>
          <span role="status" className="sr-only">{saved ? "Details saved" : ""}</span>
          <button type="button" className="btn btn-ghost profile-reset" onClick={handleReset}>Clear saved details</button>
        </div>
      </div>

      <div className="profile-account-row">
        <Link to="/signin" className="btn btn-secondary btn-sm">
          <Icon name="user" size={16} />
          Sign in to use on other devices
        </Link>
        <Link to="/plans" className="btn btn-ghost btn-sm">
          See plans
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </div>
  );
}
