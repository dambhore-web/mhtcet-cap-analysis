import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/syne/600.css";
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./global.css";
import { App } from "./App";
import { publicAddressRedirect } from "./lib/seo";

// The production site is also reachable on the hosting platform's address: send those visits (and
// crawlers, which follow it) to the public address, so there is one copy of every page
const elsewhere = publicAddressRedirect(import.meta.env.VITE_SITE_URL as string | undefined, window.location);
if (elsewhere) {
  window.location.replace(elsewhere);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
