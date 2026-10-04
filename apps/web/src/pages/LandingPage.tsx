import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, generalOpen, BRANCH_GROUPS, type DataMeta, type OpenLatestRow } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { formatNumber } from "../lib/format";
import { logBounds, logScale } from "../lib/logScale";
import { profileResultsPath } from "../lib/onboarding";
import { Icon } from "../components/Icon";
import { MeritRuler } from "../components/MeritRuler";
import { formatPercentile, meritToPercentile, parsePercentileText, percentileToMerit, type ScalePoint, type ScoreKind } from "../lib/percentile";
import { STATIC_PAGE_META, usePageMeta } from "../lib/seo";
import { branchGroupPath } from "../lib/branchGroups";
import "./OnboardingPage.css";
import "./LandingPage.css";

const HOW = [
  { title: "Your merit number", text: "Or your percentile, if the merit list isn't out yet. We estimate a range." },
  { title: "Your seat details", text: "Category, gender, home university and special seats decide which seats you can take." },
  { title: "Colleges by chance", text: "Where a student like you got a seat last year, and in which round." },
  { title: "Your option form", text: "Order your choices, test them in the simulator, export for the CAP portal." },
];

const MORE = [
  { title: "Freeze, float or slide?", text: "See which higher choices opened up in later rounds last year before you decide.", to: "/allotment", go: "Check my allotment" },
  { title: "A page for your family", text: "One shareable summary: current seat, top options, fees and dates.", to: "/summary", go: "Make the summary" },
  { title: "Ask GetMeCollege", text: "Plain answers about CAP, with the source for every figure.", to: "/ask", go: "Ask a question" },
];

/** Example merit for first-time visitors, so the ruler shows a mixed answer before anything is typed. */
const EXAMPLE_MERIT = 12000;


/** "/" for every visitor (#142, #144): all of CAP on one merit ruler, then how it works. */
export function LandingPage() {
  usePageMeta(STATIC_PAGE_META["/"]);
  const { hasProfile, profile } = useProfile();
  const resultsPath = hasProfile ? profileResultsPath(profile) : null;
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [rows, setRows] = useState<OpenLatestRow[] | null>(null);
  const [merit, setMerit] = useState<number>(profile.meritNumber ?? EXAMPLE_MERIT);
  const [meritText, setMeritText] = useState(formatNumber(profile.meritNumber ?? EXAMPLE_MERIT));
  // Students know their percentile weeks before the merit list: it is placed on the merit ruler
  // through the merit ↔ percentile pairs printed on this year's lists (GET /api/percentile-scale)
  const [kind, setKind] = useState<ScoreKind>("merit");
  const [scale, setScale] = useState<ScalePoint[] | null>(null);
  const [pctText, setPctText] = useState("");

  // Bumped by "Try again" when the cutoff lists couldn't be loaded
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    api.meta().then((m) => live && setMeta(m)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setRows(null);
    api.openLatest().then((r) => live && setRows(generalOpen(r.rows))).catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [retry]);
  const loadFailed = rows !== null && rows.length === 0;

  const values = useMemo(() => (rows ?? []).map((r) => r[4]), [rows]);
  const domain = useMemo(() => logBounds(values), [values]);
  const reach = values.filter((v) => merit <= v).length;
  const groups = useMemo(
    () => BRANCH_GROUPS.map((g) => ({ g, vals: (rows ?? []).filter((r) => r[5] === g).map((r) => r[4]) })),
    [rows],
  );

  const years = meta ? [...(meta.earlierYears ?? []), meta.year].sort() : [];
  const yearSpan = years.length > 1 ? `${years[0]}–${String(years[years.length - 1]).slice(2)}` : meta ? String(meta.year) : "";

  const setFromText = (text: string) => {
    setMeritText(text);
    const v = parseInt(text.replace(/\D/g, ""), 10);
    if (v > 0) setMerit(v);
  };
  const moveMerit = (v: number) => {
    setMerit(v);
    setMeritText(formatNumber(v));
    const p = scale ? meritToPercentile(scale, v) : null;
    if (p != null) setPctText(formatPercentile(p));
  };

  useEffect(() => {
    if (kind !== "percentile" || scale) return;
    let live = true;
    api.percentileScale("MH").then((r) => live && setScale(r.points)).catch(() => live && setScale([]));
    return () => {
      live = false;
    };
  }, [kind, scale]);

  // The percentile box starts at the current merit number's percentile once the pairs arrive; only
  // once, so clearing the box to type a new percentile doesn't fill it again
  const prefilled = useRef(false);
  useEffect(() => {
    if (kind !== "percentile" || !scale?.length || prefilled.current) return;
    prefilled.current = true;
    const p = meritToPercentile(scale, merit);
    if (p != null) setPctText(formatPercentile(p));
  }, [kind, scale, merit]);

  const setFromPct = (text: string) => {
    setPctText(text);
    const p = parsePercentileText(text);
    const m = p != null && scale?.length ? percentileToMerit(scale, p) : null;
    if (m) {
      setMerit(m);
      setMeritText(formatNumber(m));
    }
  };
  const byPct = kind === "percentile";
  const pctValue = parsePercentileText(pctText);
  const scaleMissing = byPct && scale !== null && scale.length === 0;

  return (
    <div className="onboarding-page landing">
      <header className="ob-header">
        <Link to="/" className="ob-logo" aria-label="GetMeCollege home">
          <span className="ob-logo-mark" aria-hidden="true"><Icon name="compass" size={18} /></span>
          GetMeCollege
        </Link>
        <span className="landing-sub">MHT-CET CAP cutoffs</span>
        <nav className="landing-nav" aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#branches">Branches</a>
          <Link to="/guide">CAP guide</Link>
          <Link to="/colleges" className="btn btn-secondary btn-sm">Browse colleges</Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-text">
          <p className="landing-eyebrow">
            <span>MHT-CET CAP planner</span>
            {yearSpan && <span>Official CET Cell lists, CAP <span className="mono">{yearSpan}</span></span>}
          </p>
          <h1>Find the colleges and branches your <em>merit number</em> or <em>percentile</em> can get</h1>
          <p className="landing-lede">
            Every line on the ruler below is one engineering branch, placed at the last merit number it admitted in CAP {meta?.year ?? ""}. Put in your
            merit number, or your percentile if the merit list isn't out yet, and see how many took someone like you.
          </p>
          {resultsPath && (
            <Link to={resultsPath} className="landing-continue">
              <Icon name="arrowRight" size={16} />
              Continue to my results
            </Link>
          )}
          </div>
          <div className="landing-art" aria-hidden="true">
            <img src="/student-hero.webp" width={1000} height={833} alt="" fetchPriority="high" />
          </div>
        </section>

        <section className="card landing-try" aria-label="Try your merit number or percentile">
          <div className="landing-try-left">
            <div className="landing-kind" role="group" aria-label="Search with">
              <button type="button" className={!byPct ? "active" : ""} aria-pressed={!byPct} onClick={() => setKind("merit")}>
                Merit number
              </button>
              <button type="button" className={byPct ? "active" : ""} aria-pressed={byPct} onClick={() => setKind("percentile")}>
                Percentile
              </button>
            </div>
            {byPct ? (
              <label className="landing-field">
                <span className="label">Try an MHT-CET percentile</span>
                <input
                  className="landing-merit"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={scale === null ? "Loading…" : "e.g. 96.82"}
                  disabled={!scale?.length}
                  value={pctText}
                  onChange={(e) => setFromPct(e.target.value)}
                  onBlur={() => pctValue != null && setPctText(formatPercentile(pctValue))}
                  aria-describedby="landing-verdict"
                  aria-invalid={pctText !== "" && pctValue == null}
                />
                {scaleMissing ? (
                  <span className="landing-small" role="alert">Percentiles couldn't be loaded just now. Use a merit number instead.</span>
                ) : pctText !== "" && pctValue == null ? (
                  <span className="landing-small">Enter a percentile between 0 and 100, for example 96.82.</span>
                ) : null}
              </label>
            ) : (
              <label className="landing-field">
                <span className="label">{profile.meritNumber ? "Your state merit number" : "Try a state merit number"}</span>
                <input
                  className="landing-merit"
                  inputMode="numeric"
                  autoComplete="off"
                  value={meritText}
                  onChange={(e) => setFromText(e.target.value)}
                  onBlur={() => setMeritText(formatNumber(merit))}
                  aria-describedby="landing-verdict"
                />
              </label>
            )}
            <div className="landing-ctas">
              <Link to="/welcome/start" className="btn btn-primary landing-cta">
                {hasProfile ? "Start over" : "Find my colleges"}
                <Icon name="arrowRight" size={18} />
              </Link>
              <span className="landing-small">Adds your category, gender and home university</span>
              <Link to="/colleges" className="btn btn-secondary">Browse all colleges</Link>
            </div>
          </div>
          <div className="landing-try-right">
            {rows && rows.length > 0 ? (
              <>
                <p className="landing-verdict" id="landing-verdict" aria-live="polite">
                  <b>{formatNumber(reach)} of {formatNumber(values.length)}</b> branches were within reach at{" "}
                  {byPct && pctValue != null ? (
                    <><span className="tnum">{formatPercentile(pctValue)}</span> percentile</>
                  ) : (
                    <>merit number <span className="tnum">{formatNumber(merit)}</span></>
                  )}
                  {meta ? ` in CAP ${meta.year}` : ""}.
                </p>
                {byPct && pctValue != null && (
                  <p className="landing-verdict-sub">
                    {formatPercentile(pctValue)} percentile is about merit number <span className="tnum">{formatNumber(merit)}</span> on this year's lists.
                  </p>
                )}
                <p className="landing-verdict-sub">
                  Within reach: the branch's last admitted student had your merit number or a worse one. Counts general open seats in the latest round; your
                  category, gender and home university open more, and the next step counts those.
                </p>
                <MeritRuler
                  marks={values.map((value) => ({ value }))}
                  merit={merit}
                  onMeritChange={moveMerit}
                  barcode
                  domain={domain}
                  ariaLabel={`Every branch's closing rank, with your merit number ${formatNumber(merit)}`}
                />
              </>
            ) : rows === null ? (
              <div className="landing-ruler-skeleton" aria-busy="true" />
            ) : (
              <p className="landing-verdict-sub" role="alert">
                The cutoff lists couldn't be loaded just now. You can still start with your merit number.{" "}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRetry((n) => n + 1)}>Try again</button>
              </p>
            )}
          </div>
        </section>

        {meta && (
          <section className="landing-stats" aria-label="The data GetMeCollege checks">
            <div><strong>{formatNumber(meta.colleges)}</strong><span>colleges in CAP {meta.year}</span></div>
            <div><strong>{formatNumber(meta.branches)}</strong><span>branches</span></div>
            <div><strong>{formatNumber(meta.cutoffRows)}</strong><span>closing merit numbers and percentiles</span></div>
            <div>
              <strong>{yearSpan}</strong>
              <span>CAP years, from the <Link to="/data">official CET Cell lists</Link></span>
            </div>
          </section>
        )}

        <section id="how" className="landing-section">
          <h2>How it works</h2>
          <ol className="landing-how">
            {HOW.map((h) => (
              <li key={h.title}>
                <strong>{h.title}</strong>
                <span>{h.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="branches" className="landing-section">
          <h2>Explore by branch</h2>
          <p className="landing-section-desc">Each strip is every college offering that branch. Blue lines took someone with your merit number or worse.</p>
          {loadFailed ? (
            <p className="landing-load-error" role="alert">
              The cutoff lists couldn't be loaded just now, so the strips are empty.{" "}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRetry((n) => n + 1)}>Try again</button>
            </p>
          ) : null}
          <div className="landing-groups">
            {groups.map(({ g, vals }) => (
              <Link key={g} to={branchGroupPath(g)} className="card landing-group">
                <h3>{g}</h3>
                <GroupStrip vals={vals} merit={merit} domain={domain} />
                <span className="landing-group-count">
                  {rows ? <><b>{formatNumber(vals.filter((v) => merit <= v).length)}</b> of {formatNumber(vals.length)} within reach on open seats</> : " "}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="landing-more-title">
          <h2 id="landing-more-title">After the first allotment</h2>
          <div className="landing-more">
            {MORE.map((m) => (
              <Link key={m.title} to={m.to} className="card landing-more-card">
                <h3>{m.title}</h3>
                <p>{m.text}</p>
                <span className="landing-go">{m.go} →</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>Based on last year's official closing merit numbers. A guide, not a guarantee of admission.</span>
        <nav aria-label="Footer">
          <Link to="/guide">CAP guide</Link>
          <Link to="/data">Where our numbers come from</Link>
          <Link to="/legal">Disclaimer &amp; privacy</Link>
        </nav>
      </footer>
    </div>
  );
}

/** A small barcode of one branch group's closing ranks, with the student's merit as a dark line. */
function GroupStrip({ vals, merit, domain }: { vals: number[]; merit: number; domain: [number, number] }) {
  const W = 260;
  const x = logScale(domain, 2, W - 4);
  return (
    <svg className="landing-strip" viewBox={`0 0 ${W} 26`} preserveAspectRatio="none" aria-hidden="true">
      <rect x={0} y={3} width={W} height={20} rx={3} className="landing-strip-bg" />
      {vals.map((v, i) => (
        <line key={i} x1={x(v)} x2={x(v)} y1={3} y2={23} className={merit <= v ? "reach" : undefined} />
      ))}
      <line x1={x(merit)} x2={x(merit)} y1={0} y2={26} className="landing-strip-you" />
    </svg>
  );
}
