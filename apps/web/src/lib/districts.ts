import { clip, type PageMeta } from "./seo";

/**
 * District landing pages (SEO): /engineering-colleges, /engineering-colleges/pune and
 * /engineering-colleges/pune/computer-it. The data comes from the API's /api/districts; the titles,
 * intro text and table rows are built here so the app and the build-time pages
 * (scripts/prerender.ts) say exactly the same thing. Copy rules: closing merit numbers are past
 * data, never a promise of a seat; no fee or salary is shown unless an official source gives it.
 */

export interface DistrictBranch {
  choiceCode: string;
  name: string;
  group: string | null;
  roundI: number | null;
  latest: number;
  seatType: string;
}

export interface DistrictCollege {
  code: string;
  name: string;
  collegeType: string | null;
  fee: { total: number; year: string } | null;
  placement: { medianSalary: number; graduationYear: string } | null;
  branches: DistrictBranch[];
}

export interface DistrictGroup {
  slug: string;
  name: string;
  colleges: number;
}

export interface DistrictSummary {
  slug: string;
  name: string;
  colleges: number;
  branches: number;
  groups: DistrictGroup[];
}

export interface DistrictDetail {
  year: number;
  slug: string;
  name: string;
  groups: DistrictGroup[];
  colleges: DistrictCollege[];
}

export const DISTRICT_HUB_PATH = "/engineering-colleges";
export const districtPath = (slug: string) => `/engineering-colleges/${slug}`;
export const groupPath = (district: string, group: string) => `/engineering-colleges/${district}/${group}`;

/** "Mumbai-Suburban" → "Mumbai Suburban" for headings. */
export const districtLabel = (name: string) => name.replace(/-/g, " ");

/** The merit number a branch is sorted and compared by: Round I, else the last round. */
export const closingOf = (b: DistrictBranch) => b.roundI ?? b.latest;

/** ₹4.5 lakh; salaries and fees above a lakh read better this way. */
export function formatLakh(n: number): string {
  return `₹${(n / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: n % 100000 === 0 ? 0 : 1 })} lakh`;
}

export interface CollegeRow {
  college: DistrictCollege;
  /** The branch with the lowest closing merit number (the most sought after in that year). */
  top: DistrictBranch;
}

/** One row per college, the college's lowest-closing branch first in the sort. */
export function collegeRows(colleges: DistrictCollege[]): CollegeRow[] {
  return colleges
    .filter((c) => c.branches.length > 0)
    .map((college) => ({ college, top: [...college.branches].sort((a, b) => closingOf(a) - closingOf(b))[0] }))
    .sort((a, b) => closingOf(a.top) - closingOf(b.top));
}

export interface BranchRow {
  college: DistrictCollege;
  branch: DistrictBranch;
}

/** Every branch of one group in the district, lowest closing merit number first. */
export function groupRows(colleges: DistrictCollege[], group: string): BranchRow[] {
  return colleges
    .flatMap((college) => college.branches.filter((b) => b.group === group).map((branch) => ({ college, branch })))
    .sort((a, b) => closingOf(a.branch) - closingOf(b.branch));
}

export function hubMeta(districts: number, year: number): PageMeta {
  return {
    title: `Engineering colleges in Maharashtra by district — CAP ${year} cutoffs`,
    description: clip(
      `Engineering colleges in all ${districts} Maharashtra districts with MHT-CET CAP ${year} closing merit numbers, FRA-approved fees and NIRF median salaries where published.`,
    ),
  };
}

export function districtMeta(d: Pick<DistrictDetail, "name" | "colleges" | "year">): PageMeta {
  const place = districtLabel(d.name);
  const n = d.colleges.length;
  return {
    title: `Engineering colleges in ${place} — CAP ${d.year} cutoffs, fees`,
    description: clip(
      `${n} engineering ${n === 1 ? "college" : "colleges"} in ${place} district with MHT-CET CAP ${d.year} closing merit numbers by branch, FRA-approved fees and NIRF median salaries where published.`,
    ),
  };
}

export function groupMeta(d: Pick<DistrictDetail, "name" | "colleges" | "year">, group: string): PageMeta {
  const place = districtLabel(d.name);
  const rows = groupRows(d.colleges, group);
  const colleges = new Set(rows.map((r) => r.college.code)).size;
  return {
    title: `${group} engineering colleges in ${place} — CAP ${d.year} cutoffs`,
    description: clip(
      `${rows.length} ${group} ${rows.length === 1 ? "branch" : "branches"} at ${colleges} colleges in ${place}: MHT-CET CAP ${d.year} Round I and last-round closing merit numbers on open seats, with fees where published.`,
    ),
  };
}

/** A factual opening paragraph: counts, and the lowest closing merit number in the district. */
export function districtIntro(d: Pick<DistrictDetail, "name" | "colleges" | "year">): string {
  const rows = collegeRows(d.colleges);
  const branches = d.colleges.reduce((n, c) => n + c.branches.length, 0);
  const place = districtLabel(d.name);
  const parts = [
    `${place} district has ${rows.length} engineering ${rows.length === 1 ? "college" : "colleges"} with ${branches} ${branches === 1 ? "branch" : "branches"} in MHT-CET CAP ${d.year}.`,
  ];
  const first = rows[0];
  if (first) {
    parts.push(
      `The lowest closing merit number on open seats was ${closingOf(first.top).toLocaleString("en-IN")}, for ${first.top.name} at ${first.college.name}${first.top.roundI === null ? " (last round)" : " in Round I"}.`,
    );
  }
  const withFee = d.colleges.filter((c) => c.fee).length;
  if (withFee) parts.push(`The FRA has published approved fees for ${withFee} of the ${d.colleges.length} colleges.`);
  return parts.join(" ");
}

export function groupIntro(d: Pick<DistrictDetail, "name" | "colleges" | "year">, group: string): string {
  const rows = groupRows(d.colleges, group);
  const place = districtLabel(d.name);
  const colleges = new Set(rows.map((r) => r.college.code)).size;
  const parts = [`${rows.length} ${group} ${rows.length === 1 ? "branch" : "branches"} at ${colleges} ${colleges === 1 ? "college" : "colleges"} in ${place} took part in MHT-CET CAP ${d.year}.`];
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (first && last && rows.length > 1) {
    parts.push(
      `Closing merit numbers on open seats ranged from ${closingOf(first.branch).toLocaleString("en-IN")} (${first.branch.name}, ${first.college.name}) to ${closingOf(last.branch).toLocaleString("en-IN")}.`,
    );
  }
  return parts.join(" ");
}

/** Why a fee cell is empty: government and aided colleges' fees are set by the state, not the FRA. */
export function noFeeText(collegeType: string | null): string {
  return /^(government|government-aided|deemed university|university)/i.test(collegeType ?? "") ? "Set by the state" : "Not published";
}

export const SOURCES_NOTE =
  "Closing merit numbers are from the State CET Cell's CAP lists, on open seats (state level where the branch has them, else other-than-home-university or home-university seats). " +
  "Fees are the FRA's approved annual fee; government and aided colleges' fees are set by the state, so the FRA doesn't list them. " +
  "Median salary is from the college's NIRF data for its latest graduating batch. Past cutoffs describe what happened, not what will happen.";
