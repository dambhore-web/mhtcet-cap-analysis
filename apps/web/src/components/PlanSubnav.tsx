import { NavLink } from "react-router-dom";

/** The five My CAP plan steps (docs/02-architecture/navigation.md). */
export const PLAN_STEPS = [
  { to: "/list", label: "Option form" },
  { to: "/simulator", label: "Test in simulator" },
  { to: "/export", label: "Export for CAP portal" },
  { to: "/allotment", label: "After allotment" },
  { to: "/summary", label: "Family summary" },
];

/** Step tabs for the "My CAP plan" section. */
export function PlanSubnav() {
  return (
    <nav className="subnav" aria-label="My CAP plan steps">
      {PLAN_STEPS.map((s, i) => (
        <NavLink key={s.to} to={s.to} end className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="subnav-num" aria-hidden="true">{i + 1}</span>
          {s.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** "Next step" link shown at the bottom of each My CAP plan page. */
export function PlanNextStep({ current }: { current: string }) {
  const i = PLAN_STEPS.findIndex((s) => s.to === current);
  const next = PLAN_STEPS[i + 1];
  if (!next) return null;
  return (
    <div className="plan-next">
      <span className="label">Next step</span>
      <NavLink to={next.to} className="btn btn-secondary">
        {i + 2}. {next.label}
      </NavLink>
    </div>
  );
}
