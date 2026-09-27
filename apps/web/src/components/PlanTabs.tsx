import { NavLink } from "react-router-dom";
import "./PlanTabs.css";

const TABS = [
  { to: "/list", label: "Shortlist & option form", n: 1 },
  { to: "/simulator", label: "Test in simulator", n: 2 },
  { to: "/export", label: "Export for CAP portal", n: 3 },
  { to: "/allotment", label: "After allotment", n: 4 },
] as const;

export function PlanTabs() {
  return (
    <div className="plan-tabs-bar">
      <nav className="plan-tabs" aria-label="CAP plan steps">
        {TABS.map(({ to, label, n }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => `plan-tab${isActive ? " active" : ""}`}
          >
            <span className="plan-tab-num" aria-hidden="true">{n}</span>
            <span className="plan-tab-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
