import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, BRANCH_GROUPS, type DataMeta } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { formatNumber } from "../lib/format";
import { logBounds, logScale } from "../lib/logScale";
import { profileResultsPath } from "../lib/onboarding";
import { Icon } from "../components/Icon";
import { MeritRuler } from "../components/MeritRuler";
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
  { title: "Ask Compass", text: "Plain answers about CAP, with the source for every figure.", to: "/ask", go: "Ask a question" },
];

/** Example merit for first-time visitors, so the ruler shows a mixed answer before anything is typed. */
const EXAMPLE_MERIT = 12000;

type OpenRow = [string, string, string, number | null, number, string | null];

/** "/" for every visitor (#142, #144): all of CAP on one merit ruler, then how it works. */
export function LandingPage() {
  const { hasProfile, profile } = useProfile();
  const resultsPath = hasProfile ? profileResultsPath(profile) : null;
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [rows, setRows] = useState<OpenRow[] | null>(null);
  const [merit, setMerit] = useState<number>(profile.meritNumber ?? EXAMPLE_MERIT);
  const [meritText, setMeritText] = useState(formatNumber(profile.meritNumber ?? EXAMPLE_MERIT));

  useEffect(() => {
    let live = true;
    api.meta().then((m) => live && setMeta(m)).catch(() => undefined);
    api.openLatest().then((r) => live && setRows(r.rows)).catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, []);

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
  };

  return (
    <div className="onboarding-page landing">
      <header className="ob-header">
        <Link to="/" className="ob-logo" aria-label="Compass home">
          <span className="ob-logo-mark" aria-hidden="true"><Icon name="compass" size={18} /></span>
          Compass
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
          <h1>Find the colleges and branches your <em>merit number</em> can get</h1>
          <p className="landing-lede">
            Every line on the ruler below is one engineering branch, placed at the last merit number it admitted in CAP {meta?.year ?? ""}. Put in your
            merit number and see how many took someone like you.
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

        <section className="card landing-try" aria-label="Try your merit number">
          <div className="landing-try-left">
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
                  At <span className="tnum">{formatNumber(merit)}</span>, <b>{formatNumber(reach)} of {formatNumber(values.length)}</b> branches took someone with your
                  merit or worse.
                </p>
                <p className="landing-verdict-sub">
                  Open, state-level seats in the latest CAP {meta?.year ?? ""} round. Your category, gender and home university open more seats than this; the
                  next step counts those.
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
              <p className="landing-verdict-sub">The cutoff lists couldn't be loaded just now. You can still start with your merit number.</p>
            )}
          </div>
        </section>

        {meta && (
          <section className="landing-stats" aria-label="The data Compass checks">
            <div><strong>{formatNumber(meta.colleges)}</strong><span>colleges in CAP {meta.year}</span></div>
            <div><strong>{formatNumber(meta.branches)}</strong><span>branches</span></div>
            <div><strong>{formatNumber(meta.cutoffRows)}</strong><span>closing merit numbers</span></div>
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
          <div className="landing-groups">
            {groups.map(({ g, vals }) => (
              <Link key={g} to={`/branches?group=${encodeURIComponent(g)}`} className="card landing-group">
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
