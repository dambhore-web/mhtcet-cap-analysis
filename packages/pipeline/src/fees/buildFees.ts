/**
 * Builds apps/api/src/data/fees.json from parsed FRA "Fee Approved" reports (#42).
 * Pure: the CLI (`src/cli/buildFees.ts`) does the fetching and file I/O.
 *
 * Matching, per report in priority order (newest academic year first), only for colleges that
 * no earlier report filled:
 *   1. code: the digits of the FRA institute id, zero-padded and normalised (EN6006 → 16006);
 *   2. exact normalised name, when the code is not a current CAP college.
 * Nothing is guessed: rows that match neither way are reported, and so is every current college
 * left without fees.
 */
import { normaliseCollegeCode } from "../parse/codes.ts";
import type { FraFeeRow } from "./fraReport.ts";

export interface FeeReportInput {
  /** "2026-27" */
  academicYear: string;
  /** URL of the whole report (district=all). */
  reportUrl: string;
  rows: FraFeeRow[];
}

export interface CurrentCollege {
  code: string;
  name: string;
  collegeType: string;
}

/** One fees.json entry: the FeeEntry shape of apps/api/src/feeIndex.ts plus source fields. */
export interface FeeFileEntry {
  name: string;
  collegeCode: string;
  tuitionFee: number;
  developmentFee: number;
  otherFees: number;
  totalAnnualFee: number;
  /** The FRA report states nothing about TFWS; false means "not stated", not "no TFWS seats". */
  tfwsAvailable: boolean;
  tfwsSeats: number | null;
  /** The FRA report gives no order reference or URL. */
  fraOrderRef: string | null;
  fraOrderUrl: string | null;
  sampleOnly: boolean;
  academicYear: string;
  fraInstituteId: string;
  fraName: string;
  fraStatus: string;
  fraMeetingDate: string | null;
  matchedBy: "code" | "name";
  /** The FRA report filtered to this institute. */
  sourceUrl: string;
  note?: string;
}

export interface UnmatchedCollege {
  code: string;
  name: string;
  collegeType: string;
  reason: string;
}

export interface UnusedRow {
  academicYear: string;
  instId: string;
  name: string;
  reason: string;
}

export interface FeeBuildResult {
  entries: Map<string, FeeFileEntry>;
  unmatchedColleges: UnmatchedCollege[];
  unusedRows: UnusedRow[];
}

export const normaliseName = (s: string): string =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

/** CAP college code implied by an FRA institute id (EN6007 → 06007, EN6006 → 16006). */
export function fraIdToCollegeCode(instId: string): string | null {
  const m = /^[A-Z]+(\d{1,5})$/.exec(instId);
  return m ? normaliseCollegeCode(m[1]) : null;
}

/** The report URL narrowed to one institute (same endpoint, `institute=` set). */
export function instituteUrl(reportUrl: string, instId: string): string {
  const u = new URL(reportUrl);
  u.searchParams.set("institute", instId);
  return u.toString();
}

type Amounts = Pick<FeeFileEntry, "tuitionFee" | "developmentFee" | "otherFees" | "totalAnnualFee"> & { note?: string };

/**
 * Fee amounts for a row, or a reason they can't be used. A row with a total but a zero
 * tuition/development split takes the split from an older report only when the FRA marks it
 * "No Upward Revision" and the older row has the same meeting date and the same total, i.e. it
 * is the same approval.
 */
function amountsFor(row: FraFeeRow, year: string, older: { academicYear: string; row: FraFeeRow }[]): Amounts | string {
  const { tuitionFee: t, developmentFee: d, totalFee: total } = row;
  if (total <= 0) return "total fee is 0";
  if (t + d > total) return `tuition ${t} + development ${d} exceeds total ${total}`;
  if (t + d > 0) return { tuitionFee: t, developmentFee: d, otherFees: total - t - d, totalAnnualFee: total };
  const same = older.find(
    (o) => /no upward revision/i.test(row.status) && o.row.meetingDate === row.meetingDate && o.row.totalFee === total && o.row.tuitionFee + o.row.developmentFee > 0,
  );
  if (!same) return `the ${year} report gives the total ${total} without a tuition/development split`;
  const s = same.row;
  return {
    tuitionFee: s.tuitionFee,
    developmentFee: s.developmentFee,
    otherFees: total - s.tuitionFee - s.developmentFee,
    totalAnnualFee: total,
    note: `The ${year} report gives only the total (${total}, No Upward Revision, meeting ${row.meetingDate}); tuition/development split from the ${same.academicYear} report for the same meeting.`,
  };
}

const NOT_FRA_TYPES = new Set(["Government", "Government-Aided", "Deemed University"]);

export function buildFeeEntries(reports: FeeReportInput[], colleges: CurrentCollege[]): FeeBuildResult {
  const byCode = new Map(colleges.map((c) => [c.code, c]));
  const byName = new Map<string, CurrentCollege[]>();
  for (const c of colleges) {
    const k = normaliseName(c.name);
    byName.set(k, [...(byName.get(k) ?? []), c]);
  }

  const entries = new Map<string, FeeFileEntry>();
  const unusedRows: UnusedRow[] = [];
  const skippedFor = new Map<string, string>(); // college code → why its matched row was not used

  reports.forEach((report, ri) => {
    const olderRows = (instId: string) =>
      reports.slice(ri + 1).flatMap((r) => r.rows.filter((x) => x.instId === instId).map((row) => ({ academicYear: r.academicYear, row })));

    // Resolve every row to a college first, so a code match always beats a name match.
    const claims = new Map<string, { row: FraFeeRow; by: "code" | "name" }[]>();
    for (const row of report.rows) {
      const unused = (reason: string) => unusedRows.push({ academicYear: report.academicYear, instId: row.instId, name: row.name, reason });
      if (row.stream !== "ENGG") {
        unused(`stream ${row.stream}`);
        continue;
      }
      const code = fraIdToCollegeCode(row.instId);
      let college = code ? byCode.get(code) : undefined;
      let by: "code" | "name" = "code";
      if (!college) {
        const named = byName.get(normaliseName(row.name)) ?? [];
        if (named.length === 1) {
          college = named[0];
          by = "name";
        } else {
          unused(named.length > 1 ? "name matches several current colleges" : `code ${code} is not a current CAP college and the name matches none exactly`);
          continue;
        }
      }
      claims.set(college.code, [...(claims.get(college.code) ?? []), { row, by }]);
    }

    for (const [code, list] of claims) {
      const ordered = [...list].sort((a, b) => (a.by === b.by ? 0 : a.by === "code" ? -1 : 1));
      const [first, ...rest] = ordered;
      for (const r of rest) {
        unusedRows.push({ academicYear: report.academicYear, instId: r.row.instId, name: r.row.name, reason: `${code} already matched to ${first.row.instId}` });
      }
      if (entries.has(code)) continue; // a newer report already filled it
      const amounts = amountsFor(first.row, report.academicYear, olderRows(first.row.instId));
      if (typeof amounts === "string") {
        unusedRows.push({ academicYear: report.academicYear, instId: first.row.instId, name: first.row.name, reason: amounts });
        skippedFor.set(code, `${first.row.instId} (${report.academicYear}): ${amounts}`);
        continue;
      }
      const { note, ...fees } = amounts;
      entries.set(code, {
        name: byCode.get(code)!.name,
        collegeCode: code,
        ...fees,
        tfwsAvailable: false,
        tfwsSeats: null,
        fraOrderRef: null,
        fraOrderUrl: null,
        sampleOnly: false,
        academicYear: report.academicYear,
        fraInstituteId: first.row.instId,
        fraName: first.row.name,
        fraStatus: first.row.status,
        fraMeetingDate: first.row.meetingDate,
        matchedBy: first.by,
        sourceUrl: instituteUrl(report.reportUrl, first.row.instId),
        ...(note ? { note } : {}),
      });
    }
  });

  const years = reports.map((r) => r.academicYear).join(" and ");
  const unmatchedColleges: UnmatchedCollege[] = colleges
    .filter((c) => !entries.has(c.code))
    .map((c) => {
      const skipped = skippedFor.get(c.code);
      const reason = skipped
        ? `on the FRA report but not usable: ${skipped}`
        : NOT_FRA_TYPES.has(c.collegeType)
          ? `not on the FRA ${years} engineering reports; ${c.collegeType} college (FRA approves fees of unaided private institutes only)`
          : `not on the FRA ${years} engineering reports by code or exact name`;
      return { code: c.code, name: c.name, collegeType: c.collegeType, reason };
    });

  return { entries, unmatchedColleges, unusedRows };
}

/**
 * Unused FRA rows that share at least two distinctive words with a college's name: a hint for a
 * human to check, never used as a match.
 */
export function possibleRows(college: CurrentCollege, rows: UnusedRow[]): UnusedRow[] {
  const generic = new Set(
    "college engineering engineer institute institution institutes technology technical research management and of the for in at s school campus faculty education educational society trust trusts mandal mandals shikshan prasarak sanstha sanchalit group studies science sciences dist tal"
      .split(" "),
  );
  const words = (s: string) => new Set(normaliseName(s).split(" ").filter((w) => w.length > 2 && !generic.has(w)));
  const mine = words(college.name);
  return rows.filter((r) => [...words(r.name)].filter((w) => mine.has(w)).length >= 2);
}
