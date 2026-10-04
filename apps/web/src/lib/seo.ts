import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { formatPercentile } from "./percentile";

/**
 * Per-page title, description, canonical URL and share-preview tags (SEO). The app renders in the
 * browser, so each page sets these once its data is in. Wording follows the copy rules: closing
 * ranks are past data, never a promise of a seat.
 */
export const SITE_NAME = "GetMeCollege";

export interface PageMeta {
  /** Without the site name; " | GetMeCollege" is added. */
  title: string;
  description?: string;
  /** Keep personal or state-dependent pages (option form, My account, results) out of search. */
  noindex?: boolean;
}

/** The public pages that are the same for everyone (also prerendered at build, scripts/prerender.ts). */
export const STATIC_PAGE_META: Record<string, PageMeta> = {
  "/": { title: "GetMeCollege — MHT-CET CAP cutoffs for every college and branch", description: "Closing merit numbers for every Maharashtra engineering college and branch from the official CET Cell CAP lists: every round, every seat type, earlier years." },
  "/colleges": { title: "Maharashtra engineering colleges — CAP cutoffs", description: "Every engineering college in MHT-CET CAP with its branches' closing merit numbers, sortable by how hard each was to get. From the official CET Cell lists." },
  "/branches": { title: "Engineering branches — CAP cutoffs by branch", description: "Computer, IT, E&TC, Mechanical, Civil and more: closing merit numbers by branch across Maharashtra colleges, by seat type. From the official CET Cell CAP lists." },
  "/guide": { title: "How MHT-CET CAP works — rounds, seat codes, freeze, float, slide", description: "A plain-language guide to the CAP option form, the rounds, auto-freeze, freeze, float and slide, and seat type codes such as GOPENS and TFWS." },
  "/data": { title: "Where our numbers come from", description: "The official CET Cell lists behind every closing merit number on GetMeCollege, how they are read and checked, and what past cutoffs can't tell you." },
  "/estimate": { title: "MHT-CET percentile vs merit number (rank) table", description: "MHT-CET percentile vs state merit number, and JEE Main percentile vs All India merit number, from the official CAP lists. Estimate your rank before the merit list is out." },
  "/eligibility": { title: "Which CAP seat types can I take?", description: "Home university, category, ladies, TFWS, EWS, defence and PWD seats: which MHT-CET CAP seat types apply to you and how many more branches they open." },
  "/legal": { title: "Disclaimer, privacy and terms", description: "GetMeCollege is an unofficial guide to MHT-CET CAP. What the data means, how your details are kept, and the terms of use." },
};

/** The public address, e.g. https://compass.example (VITE_SITE_URL); this origin when unset. */
export function siteUrl(): string {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, "");
  return configured || window.location.origin;
}

/**
 * Where a visit to the hosting platform's own address (*.up.railway.app) should go instead: the same
 * page on the public address, so search engines see one copy of the site. null when the visit is
 * already on the public address, or when no public address is configured (staging, local).
 */
export function publicAddressRedirect(configured: string | undefined, at: Pick<Location, "hostname" | "pathname" | "search" | "hash">): string | null {
  const site = configured?.trim().replace(/\/+$/, "");
  if (!site || !at.hostname.endsWith(".up.railway.app")) return null;
  let host: string;
  try {
    host = new URL(site).hostname;
  } catch {
    return null;
  }
  return host === at.hostname ? null : `${site}${at.pathname}${at.search}${at.hash}`;
}

export function fullTitle(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
}

/** Search engines show about 155 characters of a description. */
export function clip(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** /branches/computer-it: one branch group across Maharashtra (the app and the prerendered page). */
export function branchGroupMeta(group: string): PageMeta {
  return {
    title: `${group} engineering colleges in Maharashtra — CAP cutoffs`,
    description: clip(
      `Every Maharashtra engineering college offering ${group}: Round I and last-round MHT-CET CAP closing merit numbers by seat type, hardest to get first. From the official CET Cell lists.`,
    ),
  };
}

/** A branch's open-seat closing in one CAP year, as the college and branch pages describe it. */
export interface OpenClosing {
  year: number;
  roundI: number | null;
  roundIPct?: number | null;
  latest: number;
}

/** The open seat a branch is described by: state level first, as GET /api/cutoffs/open-latest. */
const OPEN_FALLBACK = ["GOPENS", "GOPENO", "GOPENH", "LOPENS", "LOPENO", "LOPENH"];
const ROUND_ORDER = ["I", "II", "III", "IV", "V", "VI"];

/** One branch's open-seat Round I (tightest) and last-round closing from its cutoff rows (MH list). */
export function openClosing(
  rows: readonly { list: string; round: string | number; seatType: string; closingMerit: number; closingPercentile?: number | null }[],
  year: number,
): OpenClosing | null {
  for (const st of OPEN_FALLBACK) {
    const open = rows.filter((r) => r.list === "MH" && r.seatType === st);
    if (!open.length) continue;
    const r1 = open.filter((r) => String(r.round) === "I").sort((a, b) => a.closingMerit - b.closingMerit)[0];
    const n = (r: (typeof open)[number]) => ROUND_ORDER.indexOf(String(r.round));
    const last = [...open].sort((a, b) => n(b) - n(a) || b.closingMerit - a.closingMerit)[0];
    return { year, roundI: r1?.closingMerit ?? null, roundIPct: r1?.closingPercentile ?? null, latest: last.closingMerit };
  }
  return null;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

/** "closed at merit 150 (99.97 percentile) in CAP 2026 Round I on open seats, 170 in the last round" */
export function closingPhrase(o: OpenClosing): string {
  const first = o.roundI ?? o.latest;
  const pct = o.roundI != null && o.roundIPct != null ? ` (${formatPercentile(o.roundIPct)} percentile)` : "";
  const when = o.roundI != null ? `CAP ${o.year} Round I` : `the last round of CAP ${o.year}`;
  const later = o.roundI != null && o.latest !== o.roundI ? `, ${fmt(o.latest)} in the last round` : "";
  return `closed at merit ${fmt(first)}${pct} in ${when} on open seats${later}`;
}

export function collegeMeta(
  c: { name: string; district?: string | null },
  branchCount: number,
  year: number,
  /** The branch that was hardest to get, for the description. */
  top?: { branch: string; closing: OpenClosing } | null,
): PageMeta {
  // "VJTI, Matunga, Mumbai" already says where it is: no ", Mumbai-Suburban" after it
  const place = c.district?.split(/[-\s]/)[0] ?? "";
  const where = c.district && !c.name.toLowerCase().includes(place.toLowerCase()) ? `, ${c.district}` : "";
  const branches = `${branchCount} ${branchCount === 1 ? "branch" : "branches"}`;
  return {
    title: `${c.name} cutoff ${year} — MHT-CET CAP, all branches`,
    description: clip(
      top
        ? `${c.name}${where}: MHT-CET CAP ${year} cutoffs for ${branches}. ${top.branch} ${closingPhrase(top.closing)}. Every round and seat type, from the official CET Cell lists.`
        : `Closing merit numbers for ${branches} at ${c.name}${where}: MHT-CET CAP ${year}, Round I to the last round, by seat type. From the official CET Cell lists.`,
    ),
  };
}

export function branchMeta(collegeName: string, branch: string, years: number[], open?: OpenClosing | null): PageMeta {
  const span = years.length > 1 ? `${Math.min(...years)}–${Math.max(...years)}` : years.length === 1 ? String(years[0]) : "";
  return {
    title: `${branch} cutoff, ${collegeName} — CAP${span ? ` ${span}` : ""}`,
    description: clip(
      open
        ? `${branch} at ${collegeName} ${closingPhrase(open)}. Every round and seat type${span ? `, ${span}` : ""}.`
        : `${branch} at ${collegeName}: MHT-CET CAP closing merit numbers${span ? ` for ${span}` : ""} by round and seat type, with the trend year to year. From the official CET Cell lists.`,
    ),
  };
}

function setMeta(attr: "name" | "property", key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Defaults from index.html, restored when a page without its own meta is shown. */
const DEFAULTS =
  typeof document === "undefined"
    ? { title: SITE_NAME, description: "" }
    : {
        title: document.title,
        description: document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
      };

/**
 * Sets the page's head tags. Pass null while the page's data is loading (the defaults stay). The
 * canonical URL is the path without query string or hash.
 */
export function usePageMeta(meta: PageMeta | null) {
  const { pathname } = useLocation();
  const title = meta?.title ?? null;
  const description = meta?.description ?? null;
  const noindex = meta?.noindex ?? false;

  useEffect(() => {
    if (title === null) return;
    const t = fullTitle(title);
    const d = description ?? DEFAULTS.description;
    const url = `${siteUrl()}${pathname}`;
    document.title = t;
    setMeta("name", "description", d);
    setMeta("property", "og:title", t);
    setMeta("property", "og:description", d);
    setMeta("property", "og:url", url);
    setMeta("name", "robots", noindex ? "noindex" : null);
    setCanonical(url);
    return () => {
      document.title = DEFAULTS.title;
      setMeta("name", "description", DEFAULTS.description);
      setMeta("name", "robots", null);
    };
  }, [title, description, noindex, pathname]);
}
