import { Outlet, useLocation } from "react-router-dom";
import { TopNav } from "./TopNav";
import { PlanTabs } from "./PlanTabs";
import { CompareBar } from "./CompareBar";
import "./Layout.css";

const PLAN_ROUTES = ["/list", "/simulator", "/export", "/allotment"];

export function Layout() {
  const { pathname } = useLocation();
  const showPlanTabs = PLAN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  return (
    <div className="layout">
      <TopNav />
      {showPlanTabs && <PlanTabs />}
      <main className="layout-content">
        <Outlet />
      </main>
      <CompareBar />
    </div>
  );
}
