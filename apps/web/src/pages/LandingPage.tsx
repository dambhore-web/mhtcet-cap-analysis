import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, BRANCH_GROUPS, type DataMeta } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { formatNumber } from "../lib/format";
import { Icon } from "../components/Icon";
import "./OnboardingPage.css";
import "./LandingPage.css";

const HOW = [
  { title: "Your merit number", text: "Or your percentile, if the merit list isn't out yet. We estimate a range." },
  { title: "Your seat details", text: "Category, gender, home university and special seats decide which seats you can take." },
  { title: "See colleges by chance", text: "Where a student like you got a seat last year, and in which round." },
  { title: "Build your option form", text: "Order your choices, test them in the simulator, export for the CAP portal." },
];

const MORE = [
  { title: "Freeze, float or slide?", text: "After each allotment, see which higher choices opened up last year.", to: "/allotment" },
  { title: "A page for your family", text: "One shareable summary: current seat, top options, fees and dates.", to: "/summary" },
  { title: "Ask Compass", text: "Plain answers about CAP, with the source for every figure.", to: "/ask" },
];

/** /welcome: the landing page for first-time visitors (#142). */
export function LandingPage() {
  const { hasProfile } = useProfile();
  const [meta, setMeta] = useState<DataMeta | null>(null);

  useEffect(() => {
    let live = true;
    api.meta().then((m) => live && setMeta(m)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const years = meta ? [...(meta.earlierYears ?? []), meta.year].sort() : [];
  const yearSpan = years.length > 1 ? `${years[0]}–${String(years[years.length - 1]).slice(2)}` : meta ? String(meta.year) : "";

  return (
    <div className="onboarding-page landing">
      <header className="ob-header">
        <Link to="/welcome" className="ob-logo" aria-label="Compass home">
          <span className="ob-logo-mark" aria-hidden="true"><Icon name="compass" size={18} /></span>
          Compass
        </Link>
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
            <span className="landing-eyebrow">MHT-CET CAP planner</span>
            <h1>Find the colleges and branches your merit number can get</h1>
            <p>
              Answer a few quick questions, one at a time. Compass checks every closing merit number in the official CAP lists and shows
              where a student like you got a seat last year, and in which round.
            </p>
            {hasProfile && (
              <Link to="/" className="landing-continue">
                <Icon name="arrowRight" size={16} />
                Continue to my results
              </Link>
            )}
            <div className="landing-ctas">
              <Link to="/welcome/start" className="btn btn-primary landing-cta">
                {hasProfile ? "Start over" : "Find my colleges"}
                <Icon name="arrowRight" size={18} />
              </Link>
              <Link to="/colleges" className="btn btn-secondary landing-cta">Browse colleges</Link>
            </div>
            <p className="landing-small">Free · No sign-up · About a minute</p>
          </div>
          <div className="landing-art">
            <img src="/student-hero.svg" width={560} height={440} alt="" />
            <div className="landing-art-card" aria-hidden="true">
              <span className="landing-art-tick"><Icon name="check" size={18} /></span>
              <span>
                <strong>Computer Engineering · Round I</strong>
                <span>Example result</span>
              </span>
            </div>
          </div>
        </section>

        {meta && (
          <section className="landing-stats" aria-label="The data Compass checks">
            <div><strong>{formatNumber(meta.colleges)}</strong><span>colleges in CAP {meta.year}</span></div>
            <div><strong>{formatNumber(meta.branches)}</strong><span>branches</span></div>
            <div><strong>{formatNumber(meta.cutoffRows)}</strong><span>closing merit numbers</span></div>
            <div>
              <strong>{yearSpan}</strong>
              <span>years of CAP lists · <Link to="/data">from the official CET Cell lists</Link></span>
            </div>
          </section>
        )}

        <section id="how" className="landing-section">
          <h2>How it works</h2>
          <ol className="landing-how">
            {HOW.map((h, i) => (
              <li key={h.title} className="landing-card">
                <span className="landing-num" aria-hidden="true">{i + 1}</span>
                <strong>{h.title}</strong>
                <span>{h.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="branches" className="landing-section">
          <h2>Explore by branch</h2>
          <div className="landing-chips">
            {BRANCH_GROUPS.map((g) => (
              <Link key={g} to={`/branches?group=${encodeURIComponent(g)}`} className="landing-chip">{g}</Link>
            ))}
          </div>
        </section>

        <section className="landing-section landing-more" aria-label="After you find your colleges">
          {MORE.map((m) => (
            <Link key={m.title} to={m.to} className="landing-card landing-card--link">
              <strong>{m.title}</strong>
              <span>{m.text}</span>
            </Link>
          ))}
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
