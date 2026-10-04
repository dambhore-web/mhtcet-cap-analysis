import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { analyticsActive, onConsentChange, setConsent, storedConsent, trackPageView } from "../lib/analytics";
import "./ConsentBanner.css";

/**
 * Sends a page view per route and asks once whether analytics cookies may be set (GA is started in
 * main.tsx, on the public site only). Until the visitor accepts, GA runs without cookies.
 */
export function ConsentBanner() {
  const { pathname } = useLocation();
  const [asked, setAsked] = useState(() => storedConsent() !== null);

  useEffect(() => onConsentChange(() => setAsked(storedConsent() !== null)), []);

  // Page views by path only: a new query string (a new Find search) is not a new page
  useEffect(() => {
    // after the page's own effects have set its title
    const t = window.setTimeout(() => trackPageView(pathname), 0);
    return () => window.clearTimeout(t);
  }, [pathname]);

  if (asked || !analyticsActive()) return null;
  return (
    <div className="consent-banner" role="region" aria-label="Analytics cookies">
      <p>
        May we use Google Analytics cookies to learn which pages help students? Nothing you type (merit number, category) is
        sent. <Link to="/legal?tab=privacy#cookies">Privacy</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConsent("denied")}>
          No thanks
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setConsent("granted")}>
          Accept
        </button>
      </div>
    </div>
  );
}
