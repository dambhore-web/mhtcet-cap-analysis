import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { CompareBar } from "./CompareBar";
import "./Layout.css";

export function Layout() {
  return (
    <div className="layout">
      <main className="layout-content">
        <Outlet />
      </main>
      <CompareBar />
      <BottomNav />
    </div>
  );
}
