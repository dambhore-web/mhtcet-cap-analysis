import { Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";
import { CompareBar } from "./CompareBar";
import "./Layout.css";

export function Layout() {
  return (
    <div className="layout">
      <TopNav />
      <main className="layout-content">
        <Outlet />
      </main>
      <CompareBar />
    </div>
  );
}
