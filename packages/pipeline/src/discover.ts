import type { Round } from "@mhtcet/core";
import { toRound } from "@mhtcet/core";
import type { AllotmentEntry, CutoffListEntry, ManifestFile, MeritListEntry } from "./manifest.ts";

/** Pure link extraction from the CET Cell pages (no I/O), so it can be unit-tested. */

export function hrefs(html: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1].trim());
  return out;
}

const CUTOFF_RE = /\/(\d{4})ENGG_CAP(\d)_(MH|AI|Diploma)_CutOff(?:_V(\d+))?\.pdf$/i;
const MERIT_RE = /\/meritlists\/(final|Provisional)\/FE(\d{4})_([A-Z]+)_MeritList_(?:Final|Provisional)\.pdf$/i;
const MATRIX_RE = /\/(\d{4})_fe_seatmatrix(?:_V\d+)?\.pdf$/i;

export function findCutoffLists(links: string[], year: number): CutoffListEntry[] {
  const out: CutoffListEntry[] = [];
  for (const url of new Set(links)) {
    const m = CUTOFF_RE.exec(url);
    if (!m || Number(m[1]) !== year) continue;
    const kind = (m[3].toUpperCase() === "DIPLOMA" ? "Diploma" : m[3].toUpperCase()) as CutoffListEntry["kind"];
    const round = toRound(Number(m[2]));
    const name = url.split("/").pop()!;
    out.push({ url, kind, round, version: m[4] ? Number(m[4]) : null, file: `cutoff/${name}` });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

export function findMeritLists(links: string[], year: number): MeritListEntry[] {
  const out: MeritListEntry[] = [];
  for (const url of new Set(links)) {
    const m = MERIT_RE.exec(url);
    if (!m || Number(m[2]) !== year) continue;
    const stage = m[1].toLowerCase() === "final" ? "Final" : "Provisional";
    out.push({ url, list: m[3], stage, file: `merit/${m[3]}_${stage.toLowerCase()}.pdf` });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

export function findSeatMatrix(links: string[], year: number): ManifestFile[] {
  return [...new Set(links)]
    .filter((u) => { const m = MATRIX_RE.exec(u); return m && Number(m[1]) === year; })
    .map((url) => ({ url, file: `seatmatrix/${url.split("/").pop()}` }));
}

/** Earlier years' naming on the current site: `2023ENGG_CAP1_CutOff.pdf` (MH), `_AI_CutOff`, `_CutOff_Diploma`. */
const LEGACY_CUTOFF_RE = /\/(\d{4})ENGG_CAP(\d)(_AI)?_CutOff(_Diploma)?(?:_V(\d+))?\.pdf$/i;
const LEGACY_MATRIX_RE = /\/(\d{4})SeatMatrix\.pdf$/i;

/** Cutoff lists of an earlier year, from the links on the current year's home page. */
export function findEarlierCutoffLists(links: string[], year: number): CutoffListEntry[] {
  const out = findCutoffLists(links, year);
  const seen = new Set(out.map((e) => e.url));
  for (const url of new Set(links)) {
    const m = LEGACY_CUTOFF_RE.exec(url);
    if (!m || Number(m[1]) !== year || seen.has(url)) continue;
    const kind: CutoffListEntry["kind"] = m[4] ? "Diploma" : m[3] ? "AI" : "MH";
    out.push({ url, kind, round: toRound(Number(m[2])), version: m[5] ? Number(m[5]) : null, file: `cutoff/${url.split("/").pop()!}` });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

/** Seat matrix of an earlier year (`/2025/2025SeatMatrix.pdf`), if linked. */
export function findEarlierSeatMatrix(links: string[], year: number): ManifestFile[] {
  return [...new Set(links)]
    .filter((u) => Number(LEGACY_MATRIX_RE.exec(u)?.[1]) === year)
    .map((url) => ({ url, file: `seatmatrix/${url.split("/").pop()!}` }));
}

export function findEarlierYearLinks(links: string[], year: number): string[] {
  return [...new Set(links)]
    .filter((u) => /\/(\d{4})\/\1ENGG_CAP\d_.*CutOff.*\.pdf$|\/(\d{4})\/\2SeatMatrix\.pdf$/i.test(u))
    .filter((u) => !u.includes(`/${year}/`))
    .sort();
}

const ALLOT_ROW_RE =
  /<td[^>]*>\s*(\d{4,5})\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>((?:\s*<td[^>]*>.*?<\/td>)+)/gi;
const ALLOT_LINK_RE = /https:\/\/fe(\d{4})\.mahacet\.org\/CAP-([IVX]+)\/CAPR-\2_(\d{4,5})\.pdf/g;

/** Institute-wise allotment list page → one entry per (college, round) PDF link. */
export function findAllotmentPdfs(html: string, year: number): AllotmentEntry[] {
  const out: AllotmentEntry[] = [];
  let m: RegExpExecArray | null;
  ALLOT_ROW_RE.lastIndex = 0;
  while ((m = ALLOT_ROW_RE.exec(html))) {
    const code = m[1];
    const name = decodeEntities(m[2]).trim();
    let l: RegExpExecArray | null;
    ALLOT_LINK_RE.lastIndex = 0;
    while ((l = ALLOT_LINK_RE.exec(m[3]))) {
      if (Number(l[1]) !== year || l[3] !== code) continue;
      out.push({ collegeCode: code, collegeName: name, round: l[2] as Round, url: l[0], file: `allotment/CAPR-${l[2]}_${code}.pdf` });
    }
  }
  return out;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
}
