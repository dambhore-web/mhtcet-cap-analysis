/**
 * Google Analytics 4 in consent mode, on the public site only.
 *
 * - Loads only on the public address (VITE_SITE_URL), never on staging, previews or local runs.
 * - Until the visitor accepts, analytics_storage is "denied": no cookies, only cookieless pings.
 *   Ad storage, ad personalisation and Google signals are always off.
 * - Sends the page path only, never the query string: Find and summary links carry a student's
 *   merit number, category and gender (personal data, AGENTS.md).
 * - Script loaded from a file, not inline: the Content Security Policy allows no inline scripts.
 *
 * GA admin: turn off Enhanced measurement → "Page changes based on browser history events",
 * or GA sends its own page views with the full URL. This module sends page views itself.
 */

/** The GA4 measurement ID; VITE_GA_ID overrides it (a test property for local checks). */
const MEASUREMENT_ID = (import.meta.env.VITE_GA_ID as string | undefined) || "G-QTYMBNWJY6";
const CONSENT_KEY = "gmc-analytics-consent";

export type Consent = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Whether analytics may run here: a public address is configured and this is it. */
export function analyticsEnabledAt(siteUrl: string | undefined, origin: string): boolean {
  if (!siteUrl?.trim()) return false;
  try {
    return new URL(siteUrl).origin === origin;
  } catch {
    return false;
  }
}

/** The address GA sees for a page: origin and path, no query string or hash. */
export function pageLocation(origin: string, pathname: string): string {
  return origin + pathname;
}

/** A same-site referrer without its query string (it may hold a student's details); others as they are. */
export function safeReferrer(referrer: string, origin: string): string {
  if (!referrer) return "";
  try {
    const u = new URL(referrer);
    return u.origin === origin ? pageLocation(u.origin, u.pathname) : referrer;
  } catch {
    return "";
  }
}

export function storedConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

let started = false;
const listeners = new Set<() => void>();

export function analyticsActive(): boolean {
  return started;
}

/** Called for consent changes, so the banner and the privacy page stay in step. */
export function onConsentChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Starts GA once, on the public site. Safe to call more than once. */
export function startAnalytics(): void {
  if (started || !analyticsEnabledAt(import.meta.env.VITE_SITE_URL as string | undefined, window.location.origin)) return;
  started = true;
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads the arguments object itself, not an array: keep this a function expression
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  const consent = storedConsent() ?? "denied";
  window.gtag("consent", "default", {
    analytics_storage: consent,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("js", new Date());
  // Every event (page views and GA's own, such as user_engagement) takes its address from here,
  // not from the browser's, whose query string may hold a student's details
  window.gtag("set", { page_location: pageLocation(window.location.origin, window.location.pathname) });
  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_referrer: safeReferrer(document.referrer, window.location.origin),
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(s);
}

/** One page view for a path (called on every route change). */
export function trackPageView(pathname: string): void {
  if (!started || !window.gtag) return;
  const location = pageLocation(window.location.origin, pathname);
  window.gtag("set", { page_location: location });
  window.gtag("event", "page_view", { page_location: location, page_title: document.title });
}

/** The visitor's choice: stored in this browser and passed on to GA. */
export function setConsent(consent: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
  window.gtag?.("consent", "update", { analytics_storage: consent });
  if (consent === "denied") clearGaCookies();
  listeners.forEach((fn) => fn());
}

/** Removes GA's cookies (_ga, _ga_<id>) after a visitor turns analytics cookies off. */
function clearGaCookies(): void {
  const names = document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => n === "_ga" || n.startsWith("_ga_"));
  const host = window.location.hostname;
  // GA sets them on the top domain (".getmecollege.com"); clear both forms
  for (const name of names) {
    for (const domain of ["", `; domain=${host}`, `; domain=.${host.replace(/^www\./, "")}`]) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}
