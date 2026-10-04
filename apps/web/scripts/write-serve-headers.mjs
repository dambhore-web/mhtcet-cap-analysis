// Writes dist/serve.json: security headers for `serve`, which hosts the built app on Railway.
// Runs after `vite build`. The API is on another origin (VITE_API_URL, read at build time), so the
// Content Security Policy is generated here rather than kept as a static file.
// Usage: node scripts/write-serve-headers.mjs   (from apps/web)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const apiUrl = process.env.VITE_API_URL ?? "";
let apiOrigin = "";
if (apiUrl) {
  try {
    apiOrigin = new URL(apiUrl).origin;
  } catch {
    throw new Error(`VITE_API_URL is not a valid URL: ${apiUrl}`);
  }
}

// Google sign-in and account sync (#15) talk to Supabase from the browser (auth + user_store)
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
let supabaseOrigin = "";
if (supabaseUrl) {
  try {
    supabaseOrigin = new URL(supabaseUrl).origin;
  } catch {
    throw new Error(`VITE_SUPABASE_URL is not a valid URL: ${supabaseUrl}`);
  }
}

// Google Analytics (src/lib/analytics.ts) runs on the public site only, so only its build allows
// Google's hosts (the list Google documents for GA4 under a Content Security Policy)
const analytics = Boolean(process.env.VITE_SITE_URL?.trim());
const GA_SCRIPT = "https://*.googletagmanager.com";
const GA_HOSTS = "https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com";
const GA_IMG = "https://*.google-analytics.com https://*.googletagmanager.com";

export function connectSrc(api = apiOrigin, supabase = supabaseOrigin, ga = analytics) {
  return ["connect-src 'self'", api, supabase, ga ? GA_HOSTS : ""].filter(Boolean).join(" ");
}

const csp = [
  "default-src 'self'",
  // Only the app's own bundles, plus Google Analytics' loader on the public site; never inline scripts
  analytics ? `script-src 'self' ${GA_SCRIPT}` : "script-src 'self'",
  // Google Fonts stylesheet; inline styles are allowed (component style attributes), inline scripts are not
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // PDF and spreadsheet exports use blob: and data: URLs
  analytics ? `img-src 'self' data: blob: ${GA_IMG}` : "img-src 'self' data: blob:",
  connectSrc(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const headers = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Routing is set here, not with `serve -s`: -s rewrites every extensionless URL to index.html before
// looking for a file, which would hide the prerendered pages (scripts/prerender.ts). Default: one
// catch-all to the app, as -s did; prerender.ts narrows it when it writes per-page HTML.
// Caching. Cloudflare sits in front of the site and kept sw.js and registerSW.js for 4 hours
// (2026-10-04), so visitors couldn't update after a deploy. Everything is revalidated with the
// server by default (pages, sw.js, registerSW.js, the manifest); only files whose names change
// with their content (assets/, hashed by the build) are kept for a year, and images for a day.
// Later entries override earlier ones for the same header.
export const CACHE_RULES = [
  { source: "**", headers: [{ key: "Cache-Control", value: "no-cache" }] },
  { source: "assets/**", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
  { source: "{icons/**,og-image.png,student-hero.webp,favicon.svg}", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
];

const config = {
  cleanUrls: true,
  rewrites: [{ source: "**", destination: "/index.html" }],
  headers: [{ source: "**", headers }, ...CACHE_RULES],
};
const out = fileURLToPath(new URL("../dist/serve.json", import.meta.url));
writeFileSync(out, JSON.stringify(config, null, 2) + "\n");
console.log(`[headers] wrote ${out}${apiOrigin ? ` (API ${apiOrigin})` : " (no VITE_API_URL: same-origin API)"}${supabaseOrigin ? ` (Supabase ${supabaseOrigin})` : " (no sign-in)"}`);
