import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, BRANCH_GROUPS, type FindOption, type Category, type MeritEstimate, type ResultFilters } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import type { Profile } from "../lib/profile";
import { addToList, isInList } from "../lib/list";
import { Icon } from "../components/Icon";
import { avatarTint, collegeInitials, formatNumber, formatRound } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import { UNIVERSITIES } from "../lib/universities";
import { CATEGORY_OPTIONS } from "../lib/categories";
import "./FindPage.css";

interface JeeEstimate { estimatedRank: number; rankRange: [number, number]; disclaimer: string; }

interface FormState {
  mode: "merit" | "percentile" | "jee";
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
  const [searchParams, setSearchParams] = useSearchParams();

  const initialForm: FormState = {
    ...DEFAULT,
    score: searchParams.get("merit") ?? (profile.meritNumber ? String(profile.meritNumber) : ""),
    category: (searchParams.get("cat") as Category | "") || profile.category || "",
    gender: (searchParams.get("gen") as "M" | "F") || profile.gender,
    subjectGroup: (searchParams.get("subj") as "PCM" | "PCB") || profile.subjectGroup,
    homeUniversity: searchParams.get("hu") ?? profile.homeUniversity,
    ews: searchParams.get("ews") === "1" || profile.ews,
    tfws: searchParams.get("tfws") === "1" || profile.tfws,
    defence: searchParams.get("def") === "1" || profile.defence,
    pwd: searchParams.get("pwd") === "1" || profile.pwd,
    orphan: searchParams.get("orphan") === "1" || profile.orphan,
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
  const [view, setView] = useState<"college" | "all">("college");
  const [estimate, setEstimate] = useState<MeritEstimate | null>(null);
  const [jeeEstimate, setJeeEstimate] = useState<JeeEstimate | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    if (form.mode === "percentile") {
      setJeeEstimate(null);
      const pct = parseFloat(form.score);
      if (isNaN(pct) || pct <= 0 || pct > 100) { setEstimate(null); return; }
      if (estimateTimer.current) clearTimeout(estimateTimer.current);
      estimateTimer.current = setTimeout(() => {
        api.meritEstimate(pct, form.subjectGroup).then(setEstimate).catch(() => setEstimate(null));
      }, 400);
    } else if (form.mode === "jee") {
      setEstimate(null);
      const pct = parseFloat(form.score);
      if (isNaN(pct) || pct <= 0 || pct > 100) { setJeeEstimate(null); return; }
      if (estimateTimer.current) clearTimeout(estimateTimer.current);
      estimateTimer.current = setTimeout(() => {
        api.jeeEstimate(pct).then(setJeeEstimate).catch(() => setJeeEstimate(null));
      }, 400);
    } else {
      setEstimate(null);
      setJeeEstimate(null);
    }
    return () => { if (estimateTimer.current) clearTimeout(estimateTimer.current); };
  }, [form.mode, form.score, form.subjectGroup]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleFlag(flag: "ews" | "tfws" | "defence" | "pwd" | "orphan") {
    setForm((f) => ({ ...f, [flag]: !f[flag] }));
  }

  const doSearch = useCallback(async (merit: number, f: FormState) => {
    setStatus("loading");
    setShowAll(false);
    setResultFilters({});

    // Push shareable URL
    const p: Record<string, string> = { merit: String(merit) };
    if (f.category) p.cat = f.category;
    if (f.gender !== "M") p.gen = f.gender;
    if (f.subjectGroup !== "PCM") p.subj = f.subjectGroup;
    if (f.homeUniversity) p.hu = f.homeUniversity;
    if (f.ews) p.ews = "1";
    if (f.tfws) p.tfws = "1";
    if (f.defence) p.def = "1";
    if (f.pwd) p.pwd = "1";
    if (f.orphan) p.orphan = "1";
    setSearchParams(p, { replace: true });

    const req = {
      merit,
      homeUniversity: f.homeUniversity || null,
      category: f.category || null,
      gender: f.gender,
      minorityCommunity: null,
      flags: { ews: f.ews, tfws: f.tfws, defence: f.defence, pwd: f.pwd, orphan: f.orphan },
      subjectGroup: f.subjectGroup,
    };
    lastRequest.current = req;

    try {
      const res = await api.find(req);
      setOptions(res.options);
      setSearchedMerit(merit);
      setStatus("done");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setStatus("error");
      setErrorMsg("Could not reach the server. Make sure the API is running.");
    }
  }, [setSearchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit when merit is in the URL (shared link)
  useEffect(() => {
    if (autoSubmittedRef.current) return;
    const meritParam = searchParams.get("merit");
    if (!meritParam) return;
    const merit = parseInt(meritParam, 10);
    if (isNaN(merit) || merit < 1) return;
    autoSubmittedRef.current = true;
    doSearch(merit, initialForm);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    } else if (form.mode === "jee") {
      const pct = parseFloat(rawScore);
      if (isNaN(pct) || pct <= 0 || pct > 100) { setScoreError("Enter a valid JEE percentile (1–100)."); return; }
      if (!jeeEstimate) { setScoreError("Waiting for rank estimate… try again in a moment."); return; }
      num = jeeEstimate.estimatedRank;
    } else {
      num = parseInt(rawScore, 10);
      if (isNaN(num) || num < 1) { setScoreError("Enter a valid merit number."); return; }
    }
    setScoreError("");
    await doSearch(num, form);
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
  const groups = useMemo(() => groupByCollege(options), [options]);
  const PAGE = view === "college" ? 12 : 30;
  const total = view === "college" ? groups.length : options.length;

  return (
    <div className="find-page">
      <div className="find-bg" aria-hidden="true" />

      <section className="find-hero page">
        <div className="find-copy">
          <p className="find-kicker">
            <Icon name="compass" size={14} />
            MHT-CET CAP 2026 · engineering
          </p>
          <h1>
            Your merit,<br />
            your <em>options.</em>
          </h1>
          <p>
            Enter your state merit number. See every college and branch where your merit number was good enough last year, and in which CAP round.
          </p>
          <ul className="find-steps" aria-label="How it works">
            <li><span>1</span>Enter merit number and category</li>
            <li><span>2</span>See colleges you can get, round by round</li>
            <li><span>3</span>Save options to your CAP option form</li>
          </ul>
        </div>

        <form className="find-card" onSubmit={handleSubmit} noValidate aria-labelledby="find-card-title">
          <h2 id="find-card-title">Find my options</h2>

          <div className="score-toggle" role="group" aria-label="What score do you have?">
            {([
              ["merit", "Merit number"],
              ["percentile", "CET percentile"],
              ["jee", "JEE percentile"],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                className={form.mode === m ? "active" : ""}
                aria-pressed={form.mode === m}
                onClick={() => set("mode", m)}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="form-label" htmlFor="score-input">
            {form.mode === "merit" ? "Your state merit number" : form.mode === "jee" ? "JEE Main percentile" : "Your MHT-CET percentile"}
          </label>
          <div className={`score-input-wrap${scoreError ? " invalid" : ""}`}>
            <input
              id="score-input"
              type="text"
              inputMode={form.mode === "merit" ? "numeric" : "decimal"}
              value={form.score}
              onChange={(e) => {
                set("score", e.target.value);
                setScoreError("");
              }}
              placeholder={form.mode === "merit" ? "e.g. 12840" : "e.g. 92.84"}
              aria-describedby={scoreError ? "score-error" : "score-help"}
              aria-invalid={!!scoreError}
              autoComplete="off"
            />
            <span className="score-suffix">{form.mode === "merit" ? "rank" : "%"}</span>
          </div>
          {scoreError ? (
            <div id="score-error" className="field-error" role="alert">
              <Icon name="alert" size={14} />
              {scoreError}
            </div>
          ) : (
            <div id="score-help" className="field-help">
              {form.mode === "merit" ? (
                <>Not published yet? <Link to="/estimate">Estimate it from your percentile</Link></>
              ) : (
                "We convert this to an estimated merit number range."
              )}
            </div>
          )}

          {form.mode === "percentile" && estimate && (
            <div className="estimate-hint">
              <span className="estimate-range">
                ≈ merit {formatNumber(estimate.estimatedMeritRange[0])}–{formatNumber(estimate.estimatedMeritRange[1])}
              </span>
              {estimate.method === "statistical" && <span className="estimate-stat-badge">estimate</span>}
            </div>
          )}

          {form.mode === "jee" && jeeEstimate && (
            <div className="estimate-hint">
              <span className="estimate-range">
                ≈ JEE rank {formatNumber(jeeEstimate.rankRange[0])}–{formatNumber(jeeEstimate.rankRange[1])}
              </span>
              <span className="estimate-stat-badge">All India seats</span>
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
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="subject-select">Subject group</label>
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
              aria-controls="adv-body"
            >
              <Icon name={form.showAdvanced ? "minus" : "plus"} size={14} />
              Home university and special categories
            </button>

            {form.showAdvanced && (
              <div className="adv-body" id="adv-body">
                <label className="form-label" htmlFor="uni-select">Home university</label>
                <select
                  id="uni-select"
                  value={form.homeUniversity}
                  onChange={(e) => set("homeUniversity", e.target.value)}
                  className="form-select"
                >
                  <option value="">Not sure / state level only</option>
                  {UNIVERSITIES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>

                <div className="form-label adv-flags-label">Special categories</div>
                <div className="flag-chips">
                  {(["ews", "tfws", "defence", "pwd", "orphan"] as const).map((flag) => (
                    <button
                      key={flag}
                      type="button"
                      className={`flag-chip${form[flag] ? " active" : ""}`}
                      onClick={() => toggleFlag(flag)}
                      aria-pressed={form[flag]}
                    >
                      {FLAG_LABELS[flag]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-accent btn-block find-submit" disabled={status === "loading"}>
            {status === "loading" ? "Searching…" : "Find my options"}
            {status !== "loading" && <Icon name="arrowRight" size={18} />}
          </button>

          {status === "error" && (
            <div className="field-error find-api-error" role="alert">
              <Icon name="alert" size={14} />
              {errorMsg}
            </div>
          )}

          <p className="find-card-foot">
            Based on official CET Cell cutoff lists · 387 colleges · 4 CAP rounds
          </p>
        </form>
      </section>

      {status === "done" && (
        <section className="results-wrap" ref={resultsRef} aria-labelledby="results-title">
          <div className="page results-inner">
            <div className="results-header">
              <div>
                <h2 id="results-title">
                  {options.length === 0 ? "No options found" : `${formatNumber(options.length)} options for merit ${formatNumber(searchedMerit)}`}
                </h2>
                <p>Based on last year's official closing ranks. A guide, not a guarantee.</p>
              </div>
              <div className="results-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={pdfLoading || options.length === 0}
                  onClick={async () => {
                    setPdfLoading(true);
                    try { await generateParentPDF(options, searchedMerit, profile); }
                    finally { setPdfLoading(false); }
                  }}
                >
                  <Icon name="clipboard" size={16} />
                  {pdfLoading ? "Preparing…" : "Parent summary PDF"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href).catch(() => {});
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }}
                >
                  <Icon name={shareCopied ? "check" : "share"} size={16} />
                  {shareCopied ? "Link copied" : "Share results"}
                </button>
              </div>
            </div>

            <div className="results-stats">
              <div className="stat-card">
                <strong>{formatNumber(options.length)}</strong>
                <span>options in {formatNumber(groups.length)} colleges</span>
              </div>
              <div className="stat-card safe">
                <strong>{formatNumber(roundI.length)}</strong>
                <span><Icon name="check" size={14} /> Likely in {formatRound(1)}</span>
              </div>
              <div className="stat-card later">
                <strong>{formatNumber(later.length)}</strong>
                <span><Icon name="clock" size={14} /> Likely in a later round</span>
              </div>
            </div>

            <div className="results-toolbar">
              <div className="view-toggle" role="group" aria-label="Group results">
                <button type="button" className={view === "college" ? "active" : ""} aria-pressed={view === "college"} onClick={() => { setView("college"); setShowAll(false); }}>
                  By college
                </button>
                <button type="button" className={view === "all" ? "active" : ""} aria-pressed={view === "all"} onClick={() => { setView("all"); setShowAll(false); }}>
                  All options
                </button>
              </div>
              <div className="result-filters">
                <label className="sr-only" htmlFor="rf-university">Filter by university</label>
                <select
                  id="rf-university"
                  className="rf-select"
                  value={resultFilters.university ?? ""}
                  onChange={(e) => applyFilter({ ...resultFilters, university: e.target.value || null })}
                  disabled={filterLoading}
                >
                  <option value="">All universities</option>
                  {UNIVERSITIES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="rf-branch">Filter by branch</label>
                <select
                  id="rf-branch"
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
                {filterLoading && <span className="rf-spinner" role="status" aria-label="Filtering" />}
                {(resultFilters.university || resultFilters.branchGroup) && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyFilter({})} disabled={filterLoading}>
                    <Icon name="close" size={14} />
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {options.length === 0 ? (
              <div className="empty-state">
                <h3>No seats matched this profile</h3>
                <p>Check your category and gender, add your home university, or turn on special categories such as EWS or TFWS if they apply to you.</p>
              </div>
            ) : (
              <>
                {view === "college" ? (
                  <div className="college-groups">
                    {(showAll ? groups : groups.slice(0, PAGE)).map((g) => (
                      <CollegeGroup key={g.code} group={g} merit={searchedMerit} />
                    ))}
                  </div>
                ) : (
                  <ul className="results-list">
                    {(showAll ? options : options.slice(0, PAGE)).map((opt) => (
                      <OptionRow key={opt.choiceCode + opt.seatType} opt={opt} merit={searchedMerit} showCollege />
                    ))}
                  </ul>
                )}
                {!showAll && total > PAGE && (
                  <button type="button" className="btn btn-secondary btn-block show-more" onClick={() => setShowAll(true)}>
                    Show all {formatNumber(total)} {view === "college" ? "colleges" : "options"}
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

const FLAG_LABELS = { ews: "EWS", tfws: "TFWS", defence: "Defence", pwd: "PWD", orphan: "Orphan" } as const;

interface Group {
  code: string;
  name: string;
  options: FindOption[];
  best: FindOption;
}

const STATUS_ORDER: Record<FindOption["status"], number> = { "round-I": 0, "later-round": 1, "out-of-range": 2 };

function groupByCollege(options: FindOption[]): Group[] {
  const map = new Map<string, Group>();
  for (const o of options) {
    const g = map.get(o.collegeCode);
    if (g) {
      g.options.push(o);
      if (STATUS_ORDER[o.status] < STATUS_ORDER[g.best.status]) g.best = o;
    } else {
      map.set(o.collegeCode, { code: o.collegeCode, name: o.collegeName, options: [o], best: o });
    }
  }
  // keep the API's order (best matches first)
  return [...map.values()];
}

function CollegeAvatar({ code, name }: { code: string; name: string }) {
  return (
    <span className="college-tile" style={{ background: avatarTint(code) }} aria-hidden="true">
      {collegeInitials(name, code)}
    </span>
  );
}

function CollegeGroup({ group, merit }: { group: Group; merit: number }) {
  const [open, setOpen] = useState(false);
  const shown = open ? group.options : group.options.slice(0, 3);
  return (
    <article className="college-group card">
      <header className="college-group-head">
        <CollegeAvatar code={group.code} name={group.name} />
        <div className="college-group-title">
          <h3>
            <Link to={`/colleges/${group.code}`}>{group.name}</Link>
          </h3>
          <span className="college-group-meta">
            {group.options.length} {group.options.length === 1 ? "option" : "options"} · code {group.code}
          </span>
        </div>
        <StatusBadge status={group.best.status} round={group.best.round} />
      </header>
      <ul className="results-list results-list--nested">
        {shown.map((opt) => (
          <OptionRow key={opt.choiceCode + opt.seatType} opt={opt} merit={merit} />
        ))}
      </ul>
      {group.options.length > 3 && (
        <button type="button" className="btn btn-ghost btn-sm college-group-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Show fewer" : `Show ${group.options.length - 3} more`}
        </button>
      )}
    </article>
  );
}

function OptionRow({ opt, merit, showCollege = false }: { opt: FindOption; merit: number; showCollege?: boolean }) {
  const [saved, setSaved] = useState(() => isInList(opt.choiceCode));
  const margin = opt.closingMerit - merit;

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
    <li className="option-row">
      {showCollege && <CollegeAvatar code={opt.collegeCode} name={opt.collegeName} />}
      <div className="option-detail">
        {showCollege && (
          <Link to={`/colleges/${opt.collegeCode}`} className="college-name">{opt.collegeName}</Link>
        )}
        <span className="branch-name">{opt.branch}</span>
        <span className="seat-meta">
          <abbr title={seatTypeLabel(opt.seatType)}>{seatTypeShortLabel(opt.seatType)}</abbr>
          <span aria-hidden="true">·</span>
          closed at {formatNumber(opt.closingMerit)}
          {margin !== 0 && (
            <span className={`surplus${margin > 0 ? " pos" : " neg"}`}>
              ({margin > 0 ? `${formatNumber(margin)} ranks to spare` : `${formatNumber(-margin)} ranks short`})
            </span>
          )}
        </span>
      </div>
      <StatusBadge status={opt.status} round={opt.round} />
      <button
        type="button"
        className={`save-btn${saved ? " saved" : ""}`}
        onClick={handleSave}
        aria-label={saved ? `${opt.branch} saved to your option form` : `Save ${opt.branch} at ${opt.collegeName} to your option form`}
        title={saved ? "Saved to option form" : "Save to option form"}
      >
        <Icon name={saved ? "check" : "plus"} size={16} />
      </button>
    </li>
  );
}

export function StatusBadge({ status, round }: { status: FindOption["status"]; round: FindOption["round"] }) {
  if (status === "round-I")
    return <span className="badge badge-safe"><Icon name="check" size={12} />{formatRound(1)}</span>;
  if (status === "later-round")
    return <span className="badge badge-later"><Icon name="clock" size={12} />{round ? formatRound(round) : "Later round"}</span>;
  return <span className="badge badge-out"><Icon name="minus" size={12} />Out of reach</span>;
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
