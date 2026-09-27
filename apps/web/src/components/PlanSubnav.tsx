import { NavLink } from "react-router-dom";

const STEPS = [
  { to: "/list", label: "Option form" },
  { to: "/simulator", label: "Test in simulator" },
];

/** Step tabs for the "My CAP plan" section. */
export function PlanSubnav() {
  return (
    <nav className="subnav" aria-label="My CAP plan steps">
      {STEPS.map((s, i) => (
        <NavLink key={s.to} to={s.to} end className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="subnav-num" aria-hidden="true">{i + 1}</span>
          {s.label}
        </NavLink>
      ))}
    </nav>
  );
}
