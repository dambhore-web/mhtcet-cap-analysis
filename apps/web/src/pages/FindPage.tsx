import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { api, type FindOption, type Category, type MeritEstimate } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import "./FindPage.css";

const CATEGORIES: { value: Category | ""; label: string }[] = [
  { value: "", label: "Open" },
  { value: "SC", label: "SC" },
  { value: "ST", label: "ST" },
  { value: "OBC", label: "OBC" },
  { value: "SEBC", label: "SEBC" },
  { value: "VJ", label: "VJ/DT" },
  { value: "NT1", label: "NT-A" },
  { value: "NT2", label: "NT-B" },
  { value: "NT3", label: "NT-C" },
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

interface FormState {
  mode: "merit" | "percentile";
  score: string;
  category: Category | "";
  gender: "M" | "F";
  subjectGroup: "PCM" | "PCB";
  homeUniversity: string;
  ews: boolean;
  tfws: boolean;
  defence: boolean;
  pwd: boolean;
  orphan: boolean;
  showAdvanced: boolean;
}

const DEFAULT: FormState = {
  mode: "merit",
  score: "",
  category: "",
  gender: "M",
  subjectGroup: "PCM",
  homeUniversity: "",
  ews: false,
  tfws: false,
  defence: false,
  pwd: false,
  orphan: false,
  showAdvanced: false,
};

type Status = "idle" | "loading" | "done" | "error";

export function FindPage() {
  const { profile } = useProfile();
  const initialForm: FormState = {
    ...DEFAULT,
    score: profile.meritNumber ? String(profile.meritNumber) : "",
    category: profile.category ?? "",
    gender: profile.gender,
    subjectGroup: profile.subjectGroup,
    homeUniversity: profile.homeUniversity,
    ews: profile.ews,
    tfws: profile.tfws,
    defence: profile.defence,
    pwd: profile.pwd,
    orphan: profile.orphan,
  };
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<Status>("idle");
  const [options, setOptions] = useState<FindOption[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [scoreError, setScoreError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [estimate, setEstimate] = useState<MeritEstimate | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (form.mode !== "percentile") { setEstimate(null); return; }
    const pct = parseFloat(form.score);
    if (isNaN(pct) || pct <= 0 || pct > 100) { setEstimate(null); return; }
    if (estimateTimer.current) clearTimeout(estimateTimer.current);
    estimateTimer.current = setTimeout(() => {
      api.meritEstimate(pct, form.subjectGroup).then(setEstimate).catch(() => setEstimate(null));
    }, 400);
    return () => { if (estimateTimer.current) clearTimeout(estimateTimer.current); };
  }, [form.mode, form.score, form.subjectGroup]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleFlag(flag: "ews" | "tfws" | "defence" | "pwd" | "orphan") {
    setForm((f) => ({ ...f, [flag]: !f[flag] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rawScore = form.score.replace(/,/g, "").trim();
    if (!rawScore) {
      setScoreError(`Enter your ${form.mode === "merit" ? "merit number" : "percentile"} to continue.`);
      return;
    }
    let num: number;
    if (form.mode === "percentile") {
      const pct = parseFloat(rawScore);
      if (isNaN(pct) || pct <= 0 || pct > 100) { setScoreError("Enter a valid percentile (1–100)."); return; }
      if (!estimate) { setScoreError("Waiting for merit estimate… try again in a moment."); return; }
      num = Math.round((estimate.estimatedMeritRange[0] + estimate.estimatedMeritRange[1]) / 2);
    } else {
      num = parseInt(rawScore, 10);
      if (isNaN(num) || num < 1) { setScoreError("Enter a valid merit number."); return; }
    }
    setScoreError("");
    setStatus("loading");
    setShowAll(false);

    try {
      const res = await api.find({
        merit: num,
        homeUniversity: form.homeUniversity || null,
        category: form.category || null,
        gender: form.gender,
        minorityCommunity: null,
        flags: { ews: form.ews, tfws: form.tfws, defence: form.defence, pwd: form.pwd, orphan: form.orphan },
        subjectGroup: form.subjectGroup,
      });
      setOptions(res.options);
      setStatus("done");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setStatus("error");
      setErrorMsg("Could not reach the server. Make sure the API is running.");
    }
  }

  const roundI = options.filter((o) => o.status === "round-I");
  const later = options.filter((o) => o.status === "later-round");
  const visible = showAll ? options : options.slice(0, 30);

  return (
    <div className="find-page">
      <div className="find-bg" aria-hidden="true" />

      <header className="find-header">
        <div className="find-logo">
          <span className="find-logo-mark">↗</span>
          compass
        </div>
        <span className="find-year-badge">2026</span>
        <Link to="/welcome" className="find-edit-profile">Edit profile</Link>
      </header>

      <section className="find-hero">
        <div className="find-copy">
          <div className="find-kicker">
            <span className="kicker-dot" />
            MHT-CET CAP cutoffs
          </div>
          <h1>
            Your merit,<br />
            your <em>options.</em>
          </h1>
          <p>
            Enter your 2026 state merit number and profile. See every college and branch where you can get a seat — sorted by round.
          </p>
        </div>

        <form className="find-card" onSubmit={handleSubmit} noValidate>
          <div className="find-card-head">
            <h2>Find my options.</h2>
            <div className="find-card-step">01 / 02</div>
          </div>

          <div className="score-toggle" role="group" aria-label="Score type">
            <button
              type="button"
              className={form.mode === "merit" ? "active" : ""}
              onClick={() => set("mode", "merit")}
            >
              Merit number
            </button>
            <button
              type="button"
              className={form.mode === "percentile" ? "active" : ""}
              onClick={() => set("mode", "percentile")}
            >
              Percentile
            </button>
          </div>

          <label className="form-label" htmlFor="score-input">
            {form.mode === "merit" ? "Your state merit number" : "Your MHT-CET percentile"}
          </label>
          <div className={`score-input-wrap${scoreError ? " invalid" : ""}`}>
            <input
              id="score-input"
              type="text"
              inputMode="numeric"
              value={form.score}
              onChange={(e) => {
                set("score", e.target.value);
                setScoreError("");
              }}
              placeholder={form.mode === "merit" ? "e.g. 12840" : "e.g. 92.84"}
              aria-describedby={scoreError ? "score-error" : undefined}
              aria-invalid={!!scoreError}
              autoComplete="off"
            />
            <span className="score-suffix">{form.mode === "merit" ? "MH" : "%"}</span>
          </div>
          {scoreError && (
            <div id="score-error" className="field-error" role="alert">
              {scoreError}
            </div>
          )}

          {form.mode === "percentile" && estimate && (
            <div className="estimate-hint">
              <span className="estimate-range">
                ≈ merit {estimate.estimatedMeritRange[0].toLocaleString("en-IN")}–{estimate.estimatedMeritRange[1].toLocaleString("en-IN")}
              </span>
              {estimate.method === "statistical" && <span className="estimate-stat-badge">estimate</span>}
            </div>
          )}

          <div className="form-row">
            <div>
              <label className="form-label" htmlFor="category-select">Category</label>
              <select
                id="category-select"
                value={form.category}
                onChange={(e) => set("category", e.target.value as Category | "")}
                className="form-select"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="subject-select">Subject</label>
              <select
                id="subject-select"
                value={form.subjectGroup}
                onChange={(e) => set("subjectGroup", e.target.value as "PCM" | "PCB")}
                className="form-select"
              >
                <option value="PCM">PCM</option>
                <option value="PCB">PCB</option>
              </select>
            </div>
          </div>

          <fieldset className="gender-group">
            <legend className="form-label">Gender</legend>
            <div className="gender-chips">
              <label className={`gender-chip${form.gender === "M" ? " active" : ""}`}>
                <input type="radio" name="gender" value="M" checked={form.gender === "M"} onChange={() => set("gender", "M")} />
                Male
              </label>
              <label className={`gender-chip${form.gender === "F" ? " active" : ""}`}>
                <input type="radio" name="gender" value="F" checked={form.gender === "F"} onChange={() => set("gender", "F")} />
                Female
              </label>
            </div>
          </fieldset>

          <div className="adv-section">
            <button
              type="button"
              className="adv-toggle"
              onClick={() => set("showAdvanced", !form.showAdvanced)}
              aria-expanded={form.showAdvanced}
            >
              {form.showAdvanced ? "▾" : "▸"} Home university &amp; special categories
            </button>

            {form.showAdvanced && (
              <div className="adv-body">
                <label className="form-label" htmlFor="uni-select">Home university</label>
                <select
                  id="uni-select"
                  value={form.homeUniversity}
                  onChange={(e) => set("homeUniversity", e.target.value)}
                  className="form-select"
                >
                  <option value="">— Not sure / State Level only —</option>
                  {UNIVERSITIES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>

                <div className="form-label" style={{ marginTop: "14px" }}>Special categories</div>
                <div className="flag-chips">
                  {(["ews", "tfws", "defence", "pwd", "orphan"] as const).map((flag) => (
                    <button
                      key={flag}
                      type="button"
                      className={`flag-chip${form[flag] ? " active" : ""}`}
                      onClick={() => toggleFlag(flag)}
                      aria-pressed={form[flag]}
                    >
                      {flag.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="find-submit"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Searching…" : "Find my options →"}
          </button>

          {status === "error" && (
            <div className="find-api-error" role="alert">{errorMsg}</div>
          )}

          <div className="find-card-foot">
            <strong>● 2026 official data</strong>
            <span>·</span>
            387 colleges · 4 CAP rounds
          </div>
        </form>
      </section>

      {status === "done" && (
        <section className="results-wrap" ref={resultsRef} aria-label="Your options">
          <div className="results-inner">
            <div className="results-header">
              <h2>
                Here's your <span>starting line.</span>
              </h2>
              <p>Based on 2026 official CAP cutoffs. Past data — not a guarantee.</p>
            </div>

            <div className="results-stats">
              <div className="stat-card">
                <strong>{options.length}</strong>
                <span>total options</span>
              </div>
              <div className="stat-card safe">
                <strong>{roundI.length}</strong>
                <span>Round I picks</span>
              </div>
              <div className="stat-card later">
                <strong>{later.length}</strong>
                <span>later rounds</span>
              </div>
            </div>

            {options.length === 0 ? (
              <div className="no-results">
                No seats found for this profile. Try adjusting your category or checking special categories like EWS or TFWS.
              </div>
            ) : (
              <>
                <div className="results-list" role="list">
                  {visible.map((opt) => (
                    <OptionRow key={opt.choiceCode} opt={opt} merit={parseInt(form.score.replace(/,/g, ""), 10)} />
                  ))}
                </div>
                {!showAll && options.length > 30 && (
                  <button className="show-more" onClick={() => setShowAll(true)}>
                    Show all {options.length} options →
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}

      <footer className="find-footer">
        <span><strong>Compass</strong> — MHT-CET CAP cutoffs</span>
        <span>Data from official DTE Maharashtra lists. Estimates only.</span>
      </footer>
    </div>
  );
}

function OptionRow({ opt, merit }: { opt: FindOption; merit: number }) {
  const surplus = opt.closingMerit - merit;
  const initials = opt.collegeName
    .split(" ")
    .filter((w) => w.length > 2 && /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="option-row" role="listitem">
      <div className="college-tile" aria-hidden="true">{initials || opt.collegeCode.slice(-2)}</div>
      <div className="option-detail">
        <span className="college-name">{opt.collegeName}</span>
        <span className="branch-name">{opt.branch}</span>
        <span className="seat-meta">
          {opt.seatType} · closing {opt.closingMerit.toLocaleString("en-IN")}
          {surplus !== 0 && (
            <span className={`surplus${surplus > 0 ? " pos" : " neg"}`}>
              {surplus > 0 ? `+${surplus.toLocaleString("en-IN")}` : surplus.toLocaleString("en-IN")}
            </span>
          )}
        </span>
      </div>
      <StatusBadge status={opt.status} round={opt.round} />
    </div>
  );
}

function StatusBadge({ status, round }: { status: FindOption["status"]; round: number | null }) {
  if (status === "round-I") return <span className="badge safe">Round I</span>;
  if (status === "later-round") return <span className="badge later">Round {round ?? "?"}</span>;
  return <span className="badge out">Out</span>;
}
