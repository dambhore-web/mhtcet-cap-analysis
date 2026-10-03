import type { Context } from "hono";
import { MIN_COLLEGES_PER_GROUP_PAGE, slugify } from "@mhtcet/core";
import { feeYear, type FeeIndex } from "../feeIndex.ts";
import type { AppCache } from "../startup.ts";
import { openLatestRows } from "./branches.ts";

/**
 * District landing pages (SEO): "engineering colleges in Pune", "computer engineering colleges in
 * Nagpur". Built from the same open-seat closing as the college pages (openLatestRows), plus the
 * fee and the NIRF median salary only where an official source gives them. Nothing is estimated.
 */

export interface DistrictBranch {
  choiceCode: string;
  name: string;
  /** Branch group ("Computer & IT"), or null when it fits none. */
  group: string | null;
  roundI: number | null;
  latest: number;
  seatType: string;
}

export interface DistrictCollege {
  code: string;
  name: string;
  collegeType: string | null;
  /** Total annual fee from the FRA's order or approved-fee report; null when not published. */
  fee: { total: number; year: string } | null;
  /** Median salary of the latest UG batch from the college's NIRF data; null when not published. */
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
  /** Branch groups with a landing page (at least MIN_COLLEGES_PER_GROUP_PAGE colleges). */
  groups: DistrictGroup[];
}

/** Every district's colleges with cutoffs in the cache year, keyed by slug. */
export function districtColleges(cache: AppCache, fees: FeeIndex): Map<string, { name: string; colleges: DistrictCollege[] }> {
  const byCollege = new Map<string, DistrictBranch[]>();
  for (const [choiceCode, collegeCode, name, roundI, latest, group, seatType] of openLatestRows(cache)) {
    byCollege.set(collegeCode, [...(byCollege.get(collegeCode) ?? []), { choiceCode, name, group, roundI, latest, seatType }]);
  }
  const out = new Map<string, { name: string; colleges: DistrictCollege[] }>();
  for (const [code, branches] of [...byCollege].sort(([a], [b]) => a.localeCompare(b))) {
    const col = cache.colleges.get(code);
    if (!col?.district) continue;
    const slug = slugify(col.district);
    if (!slug) continue;
    const entry = out.get(slug) ?? { name: col.district, colleges: [] };
    entry.colleges.push({
      code,
      name: col.name,
      collegeType: col.collegeType ?? null,
      fee: officialFee(fees, code),
      placement: latestMedian(cache, code),
      branches: branches.sort((p, q) => (p.roundI ?? p.latest) - (q.roundI ?? q.latest)),
    });
    out.set(slug, entry);
  }
  return out;
}

/** The fee only when it comes from the FRA (its order or its approved-fee report), as on the college page. */
function officialFee(fees: FeeIndex, code: string): DistrictCollege["fee"] {
  const e = fees.byCollege.get(code);
  if (!e || e.sampleOnly) return null;
  const official = !!e.fraOrderUrl || ((e.source ?? "FRA") === "FRA" && !!e.sourceUrl);
  return official ? { total: e.totalAnnualFee, year: feeYear(e) } : null;
}

function latestMedian(cache: AppCache, code: string): DistrictCollege["placement"] {
  const rows = (cache.placement?.get(code) ?? []).filter((r) => r.medianSalary !== null && r.medianSalary > 0);
  if (!rows.length) return null;
  const last = [...rows].sort((a, b) => a.graduationYear.localeCompare(b.graduationYear)).at(-1)!;
  return { medianSalary: last.medianSalary!, graduationYear: last.graduationYear };
}

/** The branch groups of a district with enough colleges for their own page, most colleges first. */
export function districtGroups(colleges: DistrictCollege[]): DistrictGroup[] {
  const count = new Map<string, number>();
  for (const c of colleges) {
    for (const g of new Set(c.branches.map((b) => b.group).filter((g): g is string => !!g))) count.set(g, (count.get(g) ?? 0) + 1);
  }
  return [...count]
    .filter(([, n]) => n >= MIN_COLLEGES_PER_GROUP_PAGE)
    .sort(([a, n], [b, m]) => m - n || a.localeCompare(b))
    .map(([name, colleges]) => ({ slug: slugify(name), name, colleges }));
}

export function districtSummaries(cache: AppCache, fees: FeeIndex): DistrictSummary[] {
  return [...districtColleges(cache, fees)]
    .map(([slug, d]) => ({
      slug,
      name: d.name,
      colleges: d.colleges.length,
      branches: d.colleges.reduce((n, c) => n + c.branches.length, 0),
      groups: districtGroups(d.colleges),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** GET /api/districts — every district with colleges, and its branch-group pages. */
export function getDistricts(c: Context, cache: AppCache, fees: FeeIndex) {
  return c.json({ year: cache.year, districts: districtSummaries(cache, fees) });
}

/** GET /api/districts/:slug — a district's colleges and branches, for its landing pages. */
export function getDistrict(c: Context, cache: AppCache, fees: FeeIndex) {
  const slug = c.req.param("slug") ?? "";
  const d = districtColleges(cache, fees).get(slug);
  if (!d) return c.json({ error: "not_found" }, 404);
  return c.json({ year: cache.year, slug, name: d.name, groups: districtGroups(d.colleges), colleges: d.colleges });
}
