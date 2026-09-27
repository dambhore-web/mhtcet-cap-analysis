import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import type { Category } from "../lib/api";
import type { Profile } from "../lib/profile";
import { clearProfile } from "../lib/profile";
import "./ProfilePage.css";

const CATEGORIES: { value: Category | ""; label: string; desc: string }[] = [
  { value: "", label: "Open", desc: "General" },
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

export function ProfilePage() {
  const { profile, setProfile, hasProfile } = useProfile();
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
  const [meritError, setMeritError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggleFlag(flag: keyof typeof flags) {
    setFlags((f) => ({ ...f, [flag]: !f[flag] }));
  }

  function handleSave() {
    const raw = merit.replace(/,/g, "").trim();
    if (raw) {
      const num = parseInt(raw, 10);
      if (isNaN(num) || num < 1) { setMeritError("Enter a valid merit number."); return; }
      setMeritError("");
      const p: Profile = { meritNumber: num, category: category || null, gender, subjectGroup, homeUniversity, ...flags };
      setProfile(p);
    } else {
      const p: Profile = { meritNumber: null, category: category || null, gender, subjectGroup, homeUniversity, ...flags };
      setProfile(p);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    if (!confirm("Clear your profile? You'll need to enter your merit number again.")) return;
    clearProfile();
    navigate("/welcome");
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>My Profile</h1>
        <p>Your details power the rank finder results.</p>
      </header>

      <div className="profile-body">
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
            <span className="profile-input-suffix">MH</span>
          </div>
          {meritError && <div className="profile-field-error">{meritError}</div>}
          {!hasProfile && <p className="profile-hint">You haven't set a merit number yet. Add one to use the rank finder.</p>}
        </section>

        <section className="profile-section">
          <div className="profile-label">Category</div>
          <div className="profile-cat-grid">
            {CATEGORIES.map((c) => (
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
            <option value="">— Not sure / State Level only —</option>
            {UNIVERSITIES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </section>

        <section className="profile-section">
          <div className="profile-label">Special categories</div>
          <div className="profile-flags-row">
            {(Object.keys(flags) as (keyof typeof flags)[]).map((flag) => (
              <button
                key={flag}
                type="button"
                className={`profile-flag${flags[flag] ? " active" : ""}`}
                onClick={() => { toggleFlag(flag); setSaved(false); }}
                aria-pressed={flags[flag]}
              >
                {flag.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <button className={`profile-save${saved ? " saved" : ""}`} onClick={handleSave}>
          {saved ? "✓ Saved" : "Save profile"}
        </button>

        <div className="profile-account-row">
          <Link to="/signin" className="profile-signin-link">Sign in to sync across devices</Link>
          <Link to="/plans" className="profile-plans-link">Upgrade to Season Pass ↗</Link>
        </div>

        <div className="profile-links">
          <Link to="/legal" className="profile-link">Disclaimer · Privacy · Terms</Link>
          <button className="profile-reset" onClick={handleReset}>Reset profile</button>
        </div>
      </div>
    </div>
  );
}
