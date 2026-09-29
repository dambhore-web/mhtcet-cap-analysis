import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, BRANCH_GROUPS, type Candidature, type FindOption, type Category, type ResultFilters } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import type { Profile } from "../lib/profile";
import { listItemFrom, useList } from "../lib/list";
import { AddToFormButton } from "../components/AddToFormButton";
import { LadderAxis, LadderLegend, MeritLadder, ladderDomain } from "../components/MeritLadder";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import { avatarTint, collegeInitials, formatNumber, formatRound } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import { UNIVERSITIES } from "../lib/universities";
import { activeFlags, categoryLabel, minorityLabel, type TileAnswers } from "../lib/answerTiles";
import { parseBranchGroups, parseMerit } from "../lib/onboarding";
import { AnswerTiles } from "../components/AnswerTiles";
import { ScanProgress } from "../components/ScanProgress";
import "./FindPage.css";
import { pastSummary } from "../lib/yearTrend";

/** What the last search was run with, so results can say "All India" or "estimated". */
interface SearchKind {
  candidature: Candidature;
  estimated: boolean;
}

interface FormState extends TileAnswers {
  /** The merit number as typed in its tile. */
  score: string;
  subjectGroup: "PCM" | "PCB";
}

type Status = "idle" | "loading" | "done" | "error";

/** Pause after typing a merit number before searching with it. */
const MERIT_DEBOUNCE_MS = 600;

export function FindPage() {
  const { profile, setProfile } = useProfile();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialForm: FormState = {
    exam: searchParams.get("list") === "AI" ? "AI" : "MH",
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
    minority: searchParams.get("min") ?? profile.minorityCommunity ?? "",
  };
  const [form, setForm] = useState<FormState>(initialForm);
  // Branch groups chosen during onboarding (#142) open the results filtered to them
  const initialGroups = parseBranchGroups(searchParams.get("bg"), BRANCH_GROUPS);
  // The first search after onboarding shows the "checking the CAP lists" screen
  const [scanning, setScanning] = useState(() => searchParams.get("scan") === "1" && !!searchParams.get("merit"));
  const scanRef = useRef(scanning);
  const [status, setStatus] = useState<Status>("idle");
  const [options, setOptions] = useState<FindOption[]>([]);
  const [searchedMerit, setSearchedMerit] = useState<number>(0);
  const [searchKind, setSearchKind] = useState<SearchKind>({ candidature: "MH", estimated: false });
  const [resultFilters, setResultFilters] = useState<ResultFilters>({});
  const [filterLoading, setFilterLoading] = useState(false);
  const lastRequest = useRef<Parameters<typeof api.find>[0] | null>(null);
  // Only the newest search or filter may set the results (answers can change faster than the API replies)
  const searchSeq = useRef(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [meritError, setMeritError] = useState("");
  const meritTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A merit number estimated from a percentile stays "estimated" until the student types their own
  const estimatedRef = useRef(searchParams.get("est") === "1");
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<"college" | "all">("college");
  const [whatIf, setWhatIf] = useState<number | null>(null);
  const [whatIfOptions, setWhatIfOptions] = useState<FindOption[] | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const whatIfTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const autoSubmittedRef = useRef(false);
  // The debounced merit search runs after this render has gone; it reads the answers from here
  const latest = useRef({ form, resultFilters });
  latest.current = { form, resultFilters };

  useEffect(() => () => { if (meritTimer.current) clearTimeout(meritTimer.current); }, []);

  const doSearch = useCallback(async (merit: number, f: FormState, kind: SearchKind = { candidature: "MH", estimated: false }, filters: ResultFilters = {}) => {
    const seq = ++searchSeq.current;
    setStatus("loading");
    setShowAll(false);
    setResultFilters(filters);
    setWhatIf(null);
    setWhatIfOptions(null);

    // Push shareable URL
    const p: Record<string, string> = { merit: String(merit) };
    if (kind.candidature === "AI") p.list = "AI";
    if (kind.estimated) p.est = "1";
    if (f.category) p.cat = f.category;
    if (f.gender !== "M") p.gen = f.gender;
    if (f.subjectGroup !== "PCM") p.subj = f.subjectGroup;
    if (f.homeUniversity) p.hu = f.homeUniversity;
    if (f.ews) p.ews = "1";
    if (f.tfws) p.tfws = "1";
    if (f.defence) p.def = "1";
    if (f.pwd) p.pwd = "1";
    if (f.orphan) p.orphan = "1";
    if (f.minority) p.min = f.minority;
    if (filters.branchGroups?.length) p.bg = filters.branchGroups.join(",");
    if (scanRef.current) p.scan = "1";
    setSearchParams(p, { replace: true });

    const req = {
      merit,
      candidature: kind.candidature,
      homeUniversity: f.homeUniversity || null,
      category: f.category || null,
      gender: f.gender,
      minorityCommunity: f.minority || null,
      // EWS is only for Open-category candidates
      flags: { ews: f.ews && !f.category, tfws: f.tfws, defence: f.defence, pwd: f.pwd, orphan: f.orphan },
      subjectGroup: f.subjectGroup,
    };
    lastRequest.current = req;

    try {
      const res = await api.find({ ...req, filters });
      if (seq !== searchSeq.current) return;
      setOptions(res.options);
      setSearchedMerit(merit);
      setWhatIf(null);
      setSearchKind(kind);
      setStatus("done");
    } catch {
      if (seq !== searchSeq.current) return;
      setStatus("error");
      setErrorMsg("Could not reach the server. Make sure the API is running.");
    } finally {
      if (seq === searchSeq.current) setFilterLoading(false);
    }
  }, [setSearchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the slider moves below the searched merit, fetch the broader result set.
  useEffect(() => {
    if (whatIf == null) { setWhatIfOptions(null); return; }
    if (!lastRequest.current) return;
    if (whatIfTimer.current) clearTimeout(whatIfTimer.current);
    whatIfTimer.current = setTimeout(async () => {
      setWhatIfLoading(true);
      try {
        const res = await api.find({ ...lastRequest.current!, merit: whatIf });
        setWhatIfOptions(res.options);
      } catch { /* keep client-side remark on failure */ } finally {
        setWhatIfLoading(false);
      }
    }, 500);
    return () => { if (whatIfTimer.current) clearTimeout(whatIfTimer.current); };
  }, [whatIf]);

  // Search straight away: from the URL (a shared link or the step-by-step questions), else from My details
  useEffect(() => {
    if (autoSubmittedRef.current) return;
    const merit = parseMerit(initialForm.score);
    if (!merit) return;
    autoSubmittedRef.current = true;
    doSearch(merit, initialForm, {
      candidature: initialForm.exam,
      estimated: estimatedRef.current,
    }, initialGroups.length ? { branchGroups: initialGroups } : {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Leave the scan screen: drop `scan` from the URL (a refresh or shared link won't replay it) and show the results
  const finishScan = useCallback(() => {
    scanRef.current = false;
    setScanning(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("scan");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // A failed search leaves the scan screen at once and shows the error
  useEffect(() => {
    if (scanning && status === "error") finishScan();
  }, [scanning, status, finishScan]);

  /** Search again with changed answers, and remember them in My details (state-merit answers only). */
  function searchWith(next: FormState, filters: ResultFilters) {
    const merit = parseMerit(next.score);
    if (!merit) return;
    const kind: SearchKind = { candidature: next.exam, estimated: estimatedRef.current };
    doSearch(merit, next, kind, filters);
    if (next.exam === "MH") {
      setProfile({
        ...profile,
        meritNumber: kind.estimated ? profile.meritNumber : merit,
        category: next.category || null,
        gender: next.gender,
        homeUniversity: next.homeUniversity,
        ews: next.ews,
        tfws: next.tfws,
        defence: next.defence,
        pwd: next.pwd,
        orphan: next.orphan,
        minorityCommunity: next.minority || null,
      });
    }
  }

  function changeAnswers(patch: Partial<TileAnswers>) {
    const next = { ...form, ...patch };
    setForm(next);
    searchWith(next, resultFilters);
  }

  function inputMerit(text: string) {
    setForm((f) => ({ ...f, score: text }));
    setMeritError("");
    if (meritTimer.current) clearTimeout(meritTimer.current);
    if (parseMerit(text)) meritTimer.current = setTimeout(() => commitMerit(text), MERIT_DEBOUNCE_MS);
  }

  function commitMerit(text: string) {
    if (meritTimer.current) clearTimeout(meritTimer.current);
    if (!text.trim()) return;
    const merit = parseMerit(text);
    if (!merit) {
      setMeritError("Enter a merit number, like 12450.");
      return;
    }
    const { form: f, resultFilters: filters } = latest.current;
    // Leaving the field after the typing pause already searched: nothing new to fetch
    if (lastRequest.current?.merit === merit && lastRequest.current.candidature === f.exam) return;
    estimatedRef.current = false;
    searchWith({ ...f, score: text }, filters);
  }

  async function applyFilter(newFilters: ResultFilters) {
    setResultFilters(newFilters);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newFilters.branchGroups?.length) next.set("bg", newFilters.branchGroups.join(","));
      else next.delete("bg");
      return next;
    }, { replace: true });
    if (!lastRequest.current) return;
    const seq = ++searchSeq.current;
    setWhatIfOptions(null); // stale what-if results must not shadow the filtered options
    setFilterLoading(true);
    setShowAll(false);
    try {
      const res = await api.find({ ...lastRequest.current, filters: newFilters });
      if (seq === searchSeq.current) setOptions(res.options);
    } catch {
      // keep existing results on filter failure
    } finally {
      if (seq === searchSeq.current) setFilterLoading(false);
    }
  }

  // "What if my merit were…": prefer fresh API results; fall back to client-side re-mark while loading.
  const effMerit = whatIf ?? searchedMerit;
  const shown = useMemo(() => {
    if (whatIf == null) return options;
    if (whatIfOptions) return whatIfOptions;
    return options.map((o) => withStatusFor(o, whatIf));
  }, [options, whatIf, whatIfOptions]);
  const roundI = shown.filter((o) => o.status === "round-I");
  const later = shown.filter((o) => o.status === "later-round");
  // When the slider is active, hide options that fell out-of-range at the what-if merit.
  const displayed = useMemo(
    () => (whatIf == null ? shown : shown.filter((o) => o.status !== "out-of-range")),
    [shown, whatIf],
  );
  const groups = useMemo(() => groupByCollege(displayed), [displayed]);
  const PAGE = view === "college" ? 12 : 30;
  const total = view === "college" ? groups.length : displayed.length;
  const domain = useMemo(
    () => ladderDomain(options.flatMap((o) => [o.firstRoundClosing ?? o.closingMerit, o.lastRoundClosing ?? o.closingMerit]).concat(effMerit ? [effMerit] : [])),
    [options, effMerit],
  );
  const sliderMax = useMemo(() => {
    const m = Math.max(searchedMerit, ...options.map((o) => o.lastRoundClosing ?? o.closingMerit));
    return Math.max(1000, Math.ceil((m * 1.25) / 100) * 100);
  }, [options, searchedMerit]);
  const districts = useMemo(() => [...new Set(options.map((o) => o.district).filter((d): d is string => !!d))].sort(), [options]);
  const collegeTypes = useMemo(() => [...new Set(options.map((o) => o.collegeType).filter((t): t is string => !!t))].sort(), [options]);
  const formCount = useList().length;
  // Earlier results stay on screen while changed answers are searched
  const hasResults = searchedMerit > 0 && (status === "done" || status === "loading");
  const updating = status === "loading" || filterLoading;

  if (scanning) {
    const merit = parseInt(searchParams.get("merit") ?? "0", 10);
    const pills = [
      `${searchParams.get("list") === "AI" ? "All India merit" : "Merit"} ${searchParams.get("est") === "1" ? "≈ " : ""}${formatNumber(merit)}`,
      ...(searchParams.get("list") === "AI"
        ? []
        : [
            categoryLabel(form.category),
            form.gender === "F" ? "Female" : "Male",
            form.homeUniversity || "State level only",
            ...activeFlags(form).map((f) => FLAG_LABELS[f]),
            form.minority ? minorityLabel(form.minority) : "Not minority",
          ]),
      ...initialGroups,
    ];
    return (
      <div className="find-page">
        <ScanProgress
          request={{
            merit,
            candidature: searchParams.get("list") === "AI" ? "AI" : "MH",
            estimated: searchParams.get("est") === "1",
            category: form.category,
            gender: form.gender,
            homeUniversity: form.homeUniversity,
            flags: { ews: form.ews, tfws: form.tfws, defence: form.defence, pwd: form.pwd, orphan: form.orphan },
            minority: form.minority,
          }}
          searchDone={status === "done"}
          pills={pills}
          onFinish={finishScan}
        />
      </div>
    );
  }

  return (
    <div className="find-page">
      <section className="find-top page" aria-labelledby="find-title">
        <div className="find-head">
          <div>
            <h1 id="find-title">Your options</h1>
            <p>Your answers from the questions. Change any of them here and the results below update straight away.</p>
          </div>
          <Link to="/welcome/start" className="find-restart">
            Answer the questions one at a time instead
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>

        <AnswerTiles
          answers={form}
          merit={form.score}
          meritError={meritError}
          branchGroups={resultFilters.branchGroups ?? []}
          onChange={changeAnswers}
          onMeritInput={inputMerit}
          onMeritCommit={() => commitMerit(form.score)}
          onBranchGroups={(bg) => applyFilter({ ...resultFilters, branchGroup: null, branchGroups: bg })}
        />

        <p className="find-updating" role="status" aria-live="polite">
          {updating ? (hasResults ? "Updating your options…" : "Finding your options…") : ""}
        </p>

        {status === "error" && (
          <div className="field-error find-api-error" role="alert">
            <Icon name="alert" size={14} />
            {errorMsg}
          </div>
        )}

        {searchedMerit === 0 && status === "idle" && (
          <div className="find-empty card">
            <h2>Enter your merit number to see your options</h2>
            <p>
              Type it in the merit number tile above. Not published yet?{" "}
              <Link to="/estimate">Estimate it from your percentile</Link>
            </p>
          </div>
        )}
      </section>

      {hasResults && (
        <section className={`results-wrap${updating ? " updating" : ""}`} aria-busy={updating} aria-labelledby="results-title">
          <div className="page results-inner">
            <div className="results-header">
              <div>
                <h2 id="results-title">
                  {options.length === 0
                    ? "No options found"
                    : `${formatNumber(roundI.length + later.length)} options for ${searchKind.candidature === "AI" ? "All India merit" : "merit"} ${searchKind.estimated ? "≈ " : ""}${formatNumber(effMerit)}`}
                </h2>
                <p>
                  {searchKind.candidature === "AI" ? "All India seats, from last year's All India cutoff lists. " : "Based on last year's official closing ranks. "}
                  A guide, not a guarantee.
                </p>
                {searchKind.estimated && (
                  <p className="results-estimated" role="note">
                    <span className="badge badge-sample">Estimated</span>
                    {searchKind.candidature === "AI"
                      ? " This All India merit number is estimated from your JEE percentile."
                      : " This merit number is estimated from your percentile. "}
                    {searchKind.candidature === "MH" && "Type your real merit number in the tile above once the merit list is out."}
                  </p>
                )}
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

            <p className="results-profile">
              <Link to="/eligibility" className="results-profile-link">Could other seat types add options?</Link>
            </p>

            <div className="results-layout">
            <div className="results-main">
            <div className="results-stats">
              <div className="stat-card">
                <strong>{formatNumber(roundI.length + later.length)}</strong>
                <span>options within reach, in {formatNumber(new Set([...roundI, ...later].map((o) => o.collegeCode)).size)} colleges</span>
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
                {(collegeTypes.length > 1 || resultFilters.collegeType) && (
                  <>
                    <label className="sr-only" htmlFor="rf-type">Filter by college type</label>
                    <select
                      id="rf-type"
                      className="rf-select"
                      value={resultFilters.collegeType ?? ""}
                      onChange={(e) => applyFilter({ ...resultFilters, collegeType: e.target.value || null })}
                      disabled={filterLoading}
                    >
                      <option value="">All types</option>
                      {collegeTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </>
                )}
                {(districts.length > 1 || resultFilters.district) && (
                  <>
                    <label className="sr-only" htmlFor="rf-district">Filter by district</label>
                    <select
                      id="rf-district"
                      className="rf-select"
                      value={resultFilters.district ?? ""}
                      onChange={(e) => applyFilter({ ...resultFilters, district: e.target.value || null })}
                      disabled={filterLoading}
                    >
                      <option value="">All districts</option>
                      {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </>
                )}
                {filterLoading && <span className="rf-spinner" role="status" aria-label="Filtering" />}
                {(resultFilters.university || resultFilters.district || resultFilters.collegeType) && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyFilter({ branchGroups: resultFilters.branchGroups })} disabled={filterLoading}>
                    <Icon name="close" size={14} />
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {shown.length > 0 && (
              <div className="results-legend">
                <LadderLegend showYou />
              </div>
            )}

            {shown.length === 0 ? (
              <div className="empty-state">
                <h3>No seats matched this profile</h3>
                <p>Check your category and gender, add your home university, or turn on special categories such as EWS or TFWS if they apply to you.</p>
              </div>
            ) : (
              <>
                {view === "college" ? (
                  <div className="college-groups">
                    {(showAll ? groups : groups.slice(0, PAGE)).map((g) => (
                      <CollegeGroup key={g.code} group={g} merit={effMerit} domain={domain} />
                    ))}
                  </div>
                ) : (
                  <ul className="results-list">
                    {(showAll ? displayed : displayed.slice(0, PAGE)).map((opt) => (
                      <OptionRow key={opt.choiceCode + opt.seatType} opt={opt} merit={effMerit} domain={domain} showCollege />
                    ))}
                  </ul>
                )}
                {!showAll && total > PAGE && (
                  <button type="button" className="btn btn-secondary btn-block show-more" onClick={() => setShowAll(true)}>
                    Show all {formatNumber(total)} {view === "college" ? "colleges" : "options"}
                  </button>
                )}
                <div className="results-axis"><LadderAxis domain={domain} /></div>
              </>
            )}
            </div>

            <aside className="results-side" aria-label="Explore your results">
              <section className="card results-side-card">
                <h2 className="label"><label htmlFor="whatif">What if my merit were…</label></h2>
                <p className="results-whatif-value">{formatNumber(effMerit)}</p>
                <input
                  id="whatif"
                  type="range"
                  min={1}
                  max={sliderMax}
                  step={Math.max(10, Math.round(sliderMax / 400 / 10) * 10)}
                  value={effMerit}
                  onChange={(e) => setWhatIf(parseInt(e.target.value, 10))}
                  aria-valuetext={`merit ${formatNumber(effMerit)}`}
                />
                <p className="results-side-note">
                  {whatIf == null ? "Move it to see how the results change." : whatIfLoading ? "Fetching results…" : `${formatNumber(roundI.length)} in Round I, ${formatNumber(later.length)} in a later round.`}
                </p>
                {whatIf != null && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWhatIf(null)}>
                    Back to {formatNumber(searchedMerit)}
                  </button>
                )}
              </section>
              <section className="card results-side-card">
                <h2 className="label">Your option form</h2>
                <p>{formCount ? `${formCount} ${formCount === 1 ? "choice" : "choices"} saved.` : "Use + on any branch to add it."}</p>
                <Link to="/list" className="btn btn-primary btn-block btn-sm">Build my option form</Link>
              </section>
              <section className="card results-side-card">
                <h2 className="label">Next</h2>
                <ul className="results-side-links">
                  <li><Link to="/compare">Compare colleges side by side</Link></li>
                  <li><Link to="/branches">See one branch across all colleges</Link></li>
                  <li><Link to="/ask">Ask Compass which is safest</Link></li>
                </ul>
              </section>
            </aside>
            </div>
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

function CollegeGroup({ group, merit, domain }: { group: Group; merit: number; domain: [number, number] }) {
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
          <OptionRow key={opt.choiceCode + opt.seatType} opt={opt} merit={merit} domain={domain} />
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

/** Seats of this seat type in the branch; a pool of one or two seats makes the cutoff jumpy. */
function SeatCount({ opt }: { opt: FindOption }) {
  const n = opt.seats?.seatType;
  if (n == null) return null;
  const total = opt.seats?.branch;
  const few = n <= 2;
  const title = `${n} ${seatTypeLabel(opt.seatType)} seat${n === 1 ? "" : "s"} in this branch${total ? ` (${total} in total)` : ""}` +
    (few ? ". With so few seats the closing rank can change a lot from year to year." : "");
  return (
    <>
      <span aria-hidden="true">·</span>
      <span className={`seat-count${few ? " few" : ""}`} title={title}>
        {n} seat{n === 1 ? "" : "s"}{few ? " — small pool" : ""}
      </span>
    </>
  );
}

/** "2023–2025: within the cutoff in 2 of 3 years (last round 5,600–6,400)". */
function PastYearsLine({ opt, merit }: { opt: FindOption; merit: number }) {
  const past = opt.pastYears ?? [];
  const sum = pastSummary(past, merit);
  if (!sum) return null;
  const span = sum.first === sum.last ? String(sum.first) : `${sum.first}–${sum.last}`;
  const range = sum.lo === sum.hi ? formatNumber(sum.lo) : `${formatNumber(sum.lo)}–${formatNumber(sum.hi)}`;
  const tone = sum.within === sum.years ? "pos" : sum.within === 0 ? "neg" : "mixed";
  const detail = past.map((p) => `${p.year}: ${formatNumber(p.lastRoundClosing)}`).join(", ");
  return (
    <span className={`past-years ${tone}`} title={`Last-round closing rank, same seat type — ${detail}`}>
      {span}: {sum.years === 1 ? (sum.within ? "within the cutoff" : "outside the cutoff") : `within the cutoff in ${sum.within} of ${sum.years} years`}{" "}
      <span className="past-range">(last round {range})</span>
    </span>
  );
}

function OptionRow({ opt, merit, domain, showCollege = false }: { opt: FindOption; merit: number; domain: [number, number]; showCollege?: boolean }) {
  const margin = (opt.lastRoundClosing ?? opt.closingMerit) - merit;

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
          {opt.firstRoundClosing != null && opt.lastRoundClosing != null
            ? `closed ${formatNumber(opt.firstRoundClosing)} → ${formatNumber(opt.lastRoundClosing)}`
            : `closed at ${formatNumber(opt.closingMerit)}`}
          {margin !== 0 && (
            <span className={`surplus${margin > 0 ? " pos" : " neg"}`}>
              ({margin > 0 ? `${formatNumber(margin)} ranks to spare` : `${formatNumber(-margin)} ranks short`})
            </span>
          )}
          <SeatCount opt={opt} />
        </span>
        <PastYearsLine opt={opt} merit={merit} />
      </div>
      <span className="option-ladder">
        <MeritLadder first={opt.firstRoundClosing ?? null} last={opt.lastRoundClosing ?? opt.closingMerit} you={merit} domain={domain} label={`${opt.collegeName}, ${opt.branch}`} />
      </span>
      <StatusBadge status={opt.status} round={opt.round} />
      <AddToFormButton item={listItemFrom(opt)} />
    </li>
  );
}

/** Status for a different merit number, from the option's per-round closings. */
function withStatusFor(o: FindOption, merit: number): FindOption {
  const rounds = o.rounds ?? [];
  const first = o.firstRoundClosing ?? null;
  if (first != null && merit <= first) return { ...o, status: "round-I", round: "I" };
  const later = rounds.filter((r) => r.round !== "I" && merit <= r.closingMerit);
  if (later.length) return { ...o, status: "later-round", round: later[0].round };
  if (!rounds.length && merit <= o.closingMerit) return o;
  return { ...o, status: "out-of-range" };
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
