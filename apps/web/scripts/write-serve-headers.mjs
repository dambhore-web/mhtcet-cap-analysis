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

export function connectSrc(api = apiOrigin, supabase = supabaseOrigin) {
  return ["connect-src 'self'", api, supabase].filter(Boolean).join(" ");
}

const csp = [
  "default-src 'self'",
  // Only the app's own bundles: no inline or third-party scripts (vite and the PWA plugin emit files)
  "script-src 'self'",
  // Google Fonts stylesheet; inline styles are allowed (component style attributes), inline scripts are not
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // PDF and spreadsheet exports use blob: and data: URLs
  "img-src 'self' data: blob:",
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
const config = { cleanUrls: true, rewrites: [{ source: "**", destination: "/index.html" }], headers: [{ source: "**", headers }] };
const out = fileURLToPath(new URL("../dist/serve.json", import.meta.url));
writeFileSync(out, JSON.stringify(config, null, 2) + "\n");
console.log(`[headers] wrote ${out}${apiOrigin ? ` (API ${apiOrigin})` : " (no VITE_API_URL: same-origin API)"}${supabaseOrigin ? ` (Supabase ${supabaseOrigin})` : " (no sign-in)"}`);
