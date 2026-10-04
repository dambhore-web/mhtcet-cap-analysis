import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./global.css";
import { App } from "./App";
import { publicAddressRedirect } from "./lib/seo";
import { startAnalytics } from "./lib/analytics";

// The production site is also reachable on the hosting platform's address: send those visits (and
// crawlers, which follow it) to the public address, so there is one copy of every page
const elsewhere = publicAddressRedirect(import.meta.env.VITE_SITE_URL as string | undefined, window.location);
if (elsewhere) {
  window.location.replace(elsewhere);
} else {
  startAnalytics();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
