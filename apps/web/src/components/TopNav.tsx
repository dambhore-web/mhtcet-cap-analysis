import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { loadList } from "../lib/list";
import "./TopNav.css";

const LINKS = [
  { to: "/", label: "Find colleges", end: true },
  { to: "/branches", label: "By branch", end: false },
  { to: "/colleges", label: "Colleges", end: false },
  { to: "/list", label: "My CAP plan", end: false },
  { to: "/ask", label: "Ask Compass", end: false },
  { to: "/guide", label: "CAP guide", end: false },
] as const;

function useListCount() {
  const [count, setCount] = useState(() => loadList().length);
  useEffect(() => {
    function sync() { setCount(loadList().length); }
    window.addEventListener("storage", sync);
    window.addEventListener("compass:list-update", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("compass:list-update", sync);
    };
  }, []);
  return count;
}

export function TopNav() {
  const listCount = useListCount();

  return (
    <div className="top-nav-bar">
      <header className="top-nav">
        <Link to="/" className="top-nav-logo" aria-label="Compass home">
          <span className="top-nav-logo-mark" aria-hidden="true">↗</span>
          compass
        </Link>

        <nav className="top-nav-links" aria-label="Main navigation">
          {LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `top-nav-link${isActive ? " active" : ""}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="top-nav-right">
          {listCount > 0 && (
            <NavLink
              to="/list"
              className={({ isActive }) => `top-nav-shortlist${isActive ? " active" : ""}`}
              aria-label={`My shortlist — ${listCount} items`}
            >
              <BookmarkIcon />
              <span>Shortlist · {listCount}</span>
            </NavLink>
          )}
          <NavLink
            to="/profile"
            className={({ isActive }) => `top-nav-profile${isActive ? " active" : ""}`}
            aria-label="Profile"
          >
            <ProfileIcon />
          </NavLink>
        </div>
      </header>
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
