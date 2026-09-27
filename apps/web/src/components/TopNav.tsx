import { NavLink, Link } from "react-router-dom";
import "./TopNav.css";

const LINKS = [
  { to: "/", label: "Find", end: true },
  { to: "/colleges", label: "Colleges", end: false },
  { to: "/list", label: "My List", end: false },
  { to: "/ask", label: "Ask", end: false },
] as const;

export function TopNav() {
  return (
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
        <NavLink
          to="/profile"
          className={({ isActive }) => `top-nav-profile${isActive ? " active" : ""}`}
          aria-label="Profile"
        >
          <ProfileIcon />
          <span>Profile</span>
        </NavLink>
      </div>
    </header>
  );
}

function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
