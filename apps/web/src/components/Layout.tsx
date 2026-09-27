import { Link, Outlet, useLocation } from "react-router-dom";
import { TopNav } from "./TopNav";
import { CompareBar, showsCompareBar } from "./CompareBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { useCompare } from "../lib/CompareContext";
import "./Layout.css";

export function Layout() {
  const { pathname } = useLocation();
  const { pinned } = useCompare();
  const barVisible = showsCompareBar(pathname) && pinned.length > 0;

  return (
    <div className={`layout${barVisible ? " has-compare-bar" : ""}`}>
      <a href="#main" className="skip-link">Skip to content</a>
      <TopNav />
      <main id="main" className="layout-content">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <span><strong>Compass</strong> · unofficial guide to MHT-CET CAP. Data from official CET Cell lists; past cutoffs are not a guarantee.</span>
          <nav aria-label="Footer" className="site-footer-links">
            <Link to="/guide">CAP guide</Link>
            <Link to="/data">Where our numbers come from</Link>
            <Link to="/plans">Plans</Link>
            <Link to="/legal">Disclaimer</Link>
            <Link to="/legal?tab=privacy">Privacy</Link>
            <Link to="/legal?tab=terms">Terms</Link>
          </nav>
        </div>
      </footer>
      {barVisible && (
        <ErrorBoundary silent resetKey={pathname}>
          <CompareBar />
        </ErrorBoundary>
      )}
    </div>
  );
}
