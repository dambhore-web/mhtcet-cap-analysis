import { useEffect } from "react";
import { useLocation } from "react-router-dom";

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
  "/estimate": { title: "MHT-CET percentile to merit number estimate", description: "Estimate your state merit number range from your MHT-CET percentile, and see which branches that range reached in past CAP rounds." },
  "/eligibility": { title: "Which CAP seat types can I take?", description: "Home university, category, ladies, TFWS, EWS, defence and PWD seats: which MHT-CET CAP seat types apply to you and how many more branches they open." },
  "/legal": { title: "Disclaimer, privacy and terms", description: "GetMeCollege is an unofficial guide to MHT-CET CAP. What the data means, how your details are kept, and the terms of use." },
};

/** The public address, e.g. https://compass.example (VITE_SITE_URL); this origin when unset. */
export function siteUrl(): string {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, "");
  return configured || window.location.origin;
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

export function collegeMeta(c: { name: string; district?: string | null }, branchCount: number, year: number): PageMeta {
  // "VJTI, Matunga, Mumbai" already says where it is: no ", Mumbai-Suburban" after it
  const place = c.district?.split(/[-\s]/)[0] ?? "";
  const where = c.district && !c.name.toLowerCase().includes(place.toLowerCase()) ? `, ${c.district}` : "";
  return {
    title: `${c.name} — CAP ${year} cutoffs by branch`,
    description: clip(
      `Closing merit numbers for ${branchCount} ${branchCount === 1 ? "branch" : "branches"} at ${c.name}${where}: MHT-CET CAP ${year}, Round I to the last round, by seat type. From the official CET Cell lists.`,
    ),
  };
}

export function branchMeta(collegeName: string, branch: string, years: number[]): PageMeta {
  const span = years.length > 1 ? `${Math.min(...years)}–${Math.max(...years)}` : years.length === 1 ? String(years[0]) : "";
  return {
    title: `${branch}, ${collegeName} — CAP cutoffs${span ? ` ${span}` : ""}`,
    description: clip(
      `${branch} at ${collegeName}: MHT-CET CAP closing merit numbers${span ? ` for ${span}` : ""} by round and seat type, with the trend year to year. From the official CET Cell lists.`,
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
