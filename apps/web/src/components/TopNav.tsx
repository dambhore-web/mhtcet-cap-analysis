import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useList } from "../lib/list";
import { Icon, type IconName } from "./Icon";
import "./TopNav.css";

type SectionId = "find" | "branches" | "colleges" | "plan" | "ask" | "guide" | "account";

const LINKS: { id: SectionId; to: string; label: string; icon: IconName }[] = [
  { id: "find", to: "/find", label: "Find colleges", icon: "search" },
  { id: "branches", to: "/branches", label: "By branch", icon: "steps" },
  { id: "colleges", to: "/colleges", label: "Colleges", icon: "building" },
  { id: "plan", to: "/list", label: "My CAP plan", icon: "list" },
  { id: "ask", to: "/ask", label: "Ask Compass", icon: "chat" },
  { id: "guide", to: "/guide", label: "CAP guide", icon: "book" },
];

/** Which top-level section a route belongs to, so exactly one nav item is active. */
export function sectionFor(pathname: string): SectionId | null {
  if (pathname.startsWith("/find") || pathname.startsWith("/estimate") || pathname.startsWith("/eligibility")) return "find";
  if (pathname.startsWith("/branches")) return "branches";
  if (pathname.startsWith("/colleges") || pathname.startsWith("/compare")) return "colleges";
  if (["/list", "/simulator", "/export", "/allotment", "/summary"].some((p) => pathname.startsWith(p))) return "plan";
  if (pathname.startsWith("/ask")) return "ask";
  if (pathname.startsWith("/guide")) return "guide";
  if (pathname.startsWith("/profile") || pathname.startsWith("/plans") || pathname.startsWith("/signin") || pathname.startsWith("/legal")) return "account";
  return null;
}

export function TopNav() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const active = sectionFor(pathname);
  const listCount = useList().length;
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    function onDoc(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <Link to="/" className="top-nav-logo" aria-label="Compass home">
          <span className="top-nav-logo-mark" aria-hidden="true"><Icon name="compass" size={18} /></span>
          Compass
        </Link>

        <nav className="top-nav-links" aria-label="Main navigation">
          {LINKS.map(({ id, to, label }) => (
            <Link
              key={id}
              to={to}
              className={`top-nav-link${active === id ? " active" : ""}`}
              aria-current={active === id ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="top-nav-right" ref={accountRef}>
          {listCount > 0 && (
            <Link
              to="/list"
              className="top-nav-shortlist"
              aria-label={`Option form: ${listCount} ${listCount === 1 ? "choice" : "choices"}`}
              title="Your option form"
            >
              <Icon name="list" size={16} />
              <span className="top-nav-shortlist-count">{listCount}</span>
            </Link>
          )}
          {user ? (
            <button
              type="button"
              className={`top-nav-account${active === "account" ? " active" : ""}`}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((o) => !o)}
            >
              <Icon name="user" />
              <span className="top-nav-account-label">Account</span>
            </button>
          ) : (
            <>
              <Link to="/profile" className={`top-nav-link top-nav-profile${pathname.startsWith("/profile") ? " active" : ""}`} aria-current={pathname.startsWith("/profile") ? "page" : undefined}>
                My details
              </Link>
              <Link to="/signin" className="btn btn-primary btn-sm top-nav-signin">Sign in</Link>
            </>
          )}
          {user && accountOpen && (
            <div className="top-nav-menu" role="menu">
              <span className="top-nav-menu-email">{user.email}</span>
              <Link role="menuitem" to="/profile">My details</Link>
              <Link role="menuitem" to="/plans">Plans</Link>
              <button role="menuitem" type="button" onClick={signOut}>Sign out</button>
            </div>
          )}

          <button
            type="button"
            className="top-nav-burger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={22} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-menu" className="top-nav-sheet" aria-label="Menu">
          {LINKS.map(({ id, to, label, icon }) => (
            <Link key={id} to={to} className={`top-nav-sheet-link${active === id ? " active" : ""}`} aria-current={active === id ? "page" : undefined}>
              <Icon name={icon} />
              {label}
            </Link>
          ))}
          <div className="top-nav-sheet-divider" />
          <Link to="/profile" className={`top-nav-sheet-link${pathname.startsWith("/profile") ? " active" : ""}`}>
            <Icon name="user" />
            My details
          </Link>
          <Link to="/plans" className={`top-nav-sheet-link${pathname.startsWith("/plans") ? " active" : ""}`}>
            <Icon name="tag" />
            Plans
          </Link>
          {user ? (
            <button type="button" className="top-nav-sheet-link" onClick={signOut}>Sign out</button>
          ) : (
            <Link to="/signin" className="btn btn-primary btn-block">Sign in</Link>
          )}
        </nav>
      )}
    </header>
  );
}
