import { decodeEntities } from "../discover.ts";

/** One row of the CET Cell "List of Institutes Participating in CAP" page. */
export interface InstituteListRow {
  code: string;
  name: string;
  status: string;
  totalIntake: number | null;
  /** District from college-meta.json (FR-008). */
  district?: string | null;
  /** Normalised college type from college-meta.json (FR-008). */
  collegeType?: string | null;
}

const ROW_RE =
  /InstituteCode=(\d{4,5})"\s*>\s*\d{4,5}\s*<\/a>\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>\s*(\d*)\s*<\/td>/g;

/** Parse the institute list HTML (code, name, status, total intake). Pure. */
export function parseInstituteList(html: string): InstituteListRow[] {
  const out: InstituteListRow[] = [];
  let m: RegExpExecArray | null;
  ROW_RE.lastIndex = 0;
  while ((m = ROW_RE.exec(html))) {
    out.push({
      code: m[1],
      name: decodeEntities(m[2]).replace(/\s+/g, " ").trim(),
      status: decodeEntities(m[3]).replace(/\s+/g, " ").trim(),
      totalIntake: m[4] ? Number(m[4]) : null,
    });
  }
  return out;
}
