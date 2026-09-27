import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { api, BRANCH_GROUPS, type FindOption, type Category, type MeritEstimate, type ResultFilters } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import type { Profile } from "../lib/profile";
import { addToList, isInList } from "../lib/list";
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
  const [searchedMerit, setSearchedMerit] = useState<number>(0);
  const [resultFilters, setResultFilters] = useState<ResultFilters>({});
  const [filterLoading, setFilterLoading] = useState(false);
  const lastRequest = useRef<Parameters<typeof api.find>[0] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [scoreError, setScoreError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [estimate, setEstimate] = useState<MeritEstimate | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
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
    setResultFilters({});

    const req = {
      merit: num,
      homeUniversity: form.homeUniversity || null,
      category: form.category || null,
      gender: form.gender,
      minorityCommunity: null,
      flags: { ews: form.ews, tfws: form.tfws, defence: form.defence, pwd: form.pwd, orphan: form.orphan },
      subjectGroup: form.subjectGroup,
    };
    lastRequest.current = req;

    try {
      const res = await api.find(req);
      setOptions(res.options);
      setSearchedMerit(num);
      setStatus("done");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setStatus("error");
      setErrorMsg("Could not reach the server. Make sure the API is running.");
    }
  }

  async function applyFilter(newFilters: ResultFilters) {
    if (!lastRequest.current) return;
    setResultFilters(newFilters);
    setFilterLoading(true);
    setShowAll(false);
    try {
      const res = await api.find({ ...lastRequest.current, filters: newFilters });
      setOptions(res.options);
    } catch {
      // keep existing results on filter failure
    } finally {
      setFilterLoading(false);
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

            <button
              className={`parent-pdf-btn${pdfLoading ? " loading" : ""}`}
              disabled={pdfLoading || options.length === 0}
              onClick={async () => {
                setPdfLoading(true);
                try { await generateParentPDF(options, searchedMerit, profile); }
                finally { setPdfLoading(false); }
              }}
            >
              {pdfLoading ? "Generating…" : "Share with parent (PDF)"}
            </button>

            <div className="result-filters">
              <span className="rf-label">Filter:</span>
              <select
                className="rf-select"
                value={resultFilters.university ?? ""}
                onChange={(e) => applyFilter({ ...resultFilters, university: e.target.value || null })}
                disabled={filterLoading}
              >
                <option value="">All universities</option>
                {UNIVERSITIES.map((u) => (
                  <option key={u} value={u}>{u.replace("University", "Univ.")}</option>
                ))}
              </select>
              <select
                className="rf-select"
                value={resultFilters.branchGroup ?? ""}
                onChange={(e) => applyFilter({ ...resultFilters, branchGroup: e.target.value || null })}
                disabled={filterLoading}
              >
                <option value="">All branches</option>
                {BRANCH_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {filterLoading && <span className="rf-spinner" aria-label="Filtering…" />}
              {(resultFilters.university || resultFilters.branchGroup) && (
                <button
                  className="rf-clear"
                  onClick={() => applyFilter({})}
                  disabled={filterLoading}
                >
                  Clear ×
                </button>
              )}
            </div>

            {options.length === 0 ? (
              <div className="no-results">
                No seats found for this profile. Try adjusting your category or checking special categories like EWS or TFWS.
              </div>
            ) : (
              <>
                <div className="results-list" role="list">
                  {visible.map((opt) => (
                    <OptionRow key={opt.choiceCode} opt={opt} merit={searchedMerit} />
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
  const [saved, setSaved] = useState(() => isInList(opt.choiceCode));
  const surplus = opt.closingMerit - merit;
  const initials = opt.collegeName
    .split(" ")
    .filter((w) => w.length > 2 && /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  function handleSave() {
    if (saved) return;
    addToList({
      choiceCode: opt.choiceCode,
      collegeCode: opt.collegeCode,
      collegeName: opt.collegeName,
      branch: opt.branch,
      seatType: opt.seatType,
      closingMerit: opt.closingMerit,
      year: opt.year,
    });
    setSaved(true);
  }

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
      <button
        className={`save-btn${saved ? " saved" : ""}`}
        onClick={handleSave}
        aria-label={saved ? "Saved to list" : "Save to list"}
        title={saved ? "Saved" : "Save to My List"}
      >
        {saved ? "✓" : "+"}
      </button>
    </div>
  );
}

function StatusBadge({ status, round }: { status: FindOption["status"]; round: number | null }) {
  if (status === "round-I") return <span className="badge safe">Round I</span>;
  if (status === "later-round") return <span className="badge later">Round {round ?? "?"}</span>;
  return <span className="badge out">Out</span>;
}

async function generateParentPDF(options: FindOption[], merit: number, profile: Profile) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;

  // ── Violet header band ──────────────────────────────────────────────────
  doc.setFillColor(101, 82, 216);
  doc.rect(0, 0, W, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("MHT-CET CAP 2026 — College Admission Summary", 12, 14);

  doc.setFontSize(11);
  doc.setTextColor(214, 249, 90); // lime
  doc.text("Compass", W - 12, 14, { align: "right" });

  // ── Student profile row ──────────────────────────────────────────────────
  doc.setFillColor(243, 241, 255);
  doc.rect(0, 22, W, 20, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 120);
  doc.text("STUDENT PROFILE", 12, 29);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 40);
  const meritText = merit > 0 ? merit.toLocaleString("en-IN") : "—";
  doc.text(meritText, 12, 39);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 100);
  const cat = profile.category ?? "Open";
  const flags: string[] = [];
  if (profile.ews) flags.push("EWS");
  if (profile.tfws) flags.push("TFWS");
  if (profile.defence) flags.push("Defence");
  if (profile.pwd) flags.push("PWD");
  if (profile.orphan) flags.push("Orphan");
  const profileLine = [
    `Category: ${cat}`,
    `Gender: ${profile.gender === "M" ? "Male" : "Female"}`,
    `Subject: ${profile.subjectGroup}`,
    ...(flags.length ? [`Flags: ${flags.join(", ")}`] : []),
    ...(profile.homeUniversity ? [`Home University: ${profile.homeUniversity}`] : []),
  ].join("   ·   ");
  doc.text(profileLine, 55, 36);

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 120);
  doc.text("State merit number", 12, 43);

  // ── Top 5 options table ──────────────────────────────────────────────────
  const top5 = [
    ...options.filter((o) => o.status === "round-I"),
    ...options.filter((o) => o.status === "later-round"),
  ].slice(0, 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 40);
  doc.text("Top College Options (2026 official cutoffs)", 12, 51);

  autoTable(doc, {
    startY: 53,
    margin: { left: 12, right: 12 },
    head: [["#", "College", "Branch", "Seat Type", "Closing Merit", "Your Position"]],
    body: top5.map((o, i) => {
      const surplus = o.closingMerit - merit;
      const pos = surplus >= 0 ? `+${surplus.toLocaleString("en-IN")} seats to spare` : `${Math.abs(surplus).toLocaleString("en-IN")} below cutoff`;
      return [
        String(i + 1),
        o.collegeName,
        o.branch,
        o.seatType,
        o.closingMerit.toLocaleString("en-IN"),
        pos,
      ];
    }),
    styles: { fontSize: 8, cellPadding: 3, font: "helvetica" },
    headStyles: { fillColor: [101, 82, 216], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 72 },
      2: { cellWidth: 58 },
      3: { cellWidth: 22 },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 44 },
    },
    alternateRowStyles: { fillColor: [248, 246, 255] },
    didParseCell(data) {
      if (data.column.index === 5 && data.section === "body") {
        const txt = String(data.cell.raw ?? "");
        data.cell.styles.textColor = txt.startsWith("+") ? [21, 128, 61] : [185, 28, 28];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const afterTable = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 110;

  // ── Checklist ────────────────────────────────────────────────────────────
  const clY = afterTable + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 40);
  doc.text("CAP Reporting Checklist", 12, clY);

  const checklist = [
    "Allotment letter (printed, self-attested copy)",
    "MHT-CET 2026 scorecard / hall ticket",
    "SSC (10th) and HSC (12th) marksheets + passing certificates",
    "Category certificate (if applicable) — issued by competent authority",
    "Domicile / nationality certificate",
    "Gap certificate (if applicable)",
    "Passport-size photographs (6–8 copies)",
    "Original documents for verification at CAP centre",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 60);
  checklist.forEach((item, i) => {
    doc.text(`□  ${item}`, 14, clY + 6 + i * 6);
  });

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.setFillColor(240, 238, 255);
  doc.rect(0, 196, W, 14, "F");

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 120);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Data from official DTE Maharashtra / CET Cell lists. Past cutoffs are indicative only — not a guarantee of admission. Verify all details at cetcell.mahacet.org",
    12,
    202
  );
  doc.setFont("helvetica", "bold");
  doc.setTextColor(101, 82, 216);
  doc.text("Generated by Compass · cetcell.mahacet.org", W - 12, 202, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 150);
  doc.text(`Prepared: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, W - 12, 207, { align: "right" });

  doc.save(`compass-parent-summary-${merit}.pdf`);
}
