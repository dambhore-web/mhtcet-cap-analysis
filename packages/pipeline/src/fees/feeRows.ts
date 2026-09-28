import type { FeeFileEntry } from "./buildFees.ts";

/** One row of the `fee` table (migration 004). */
export interface FeeRow {
  collegeCode: string;
  academicYear: string;
  tuitionFee: number | null;
  developmentFee: number | null;
  otherFees: number | null;
  totalFee: number;
  source: "FRA" | "college";
  sourceUrl: string;
  fraInstituteId: string | null;
  fraStatus: string | null;
  fraMeetingDate: string | null;
  tfwsAvailable: boolean | null;
  notes: string | null;
}

export interface FeeProblem {
  collegeCode: string;
  problem: string;
}

/** Rows from fees.json (built from the FRA reports by `npm run fees`). */
export function rowsFromFraFile(file: Record<string, unknown>): FeeRow[] {
  const out: FeeRow[] = [];
  for (const [key, value] of Object.entries(file)) {
    if (key.startsWith("_")) continue;
    const e = value as FeeFileEntry & { note?: string };
    out.push({
      collegeCode: e.collegeCode,
      academicYear: e.academicYear,
      tuitionFee: e.tuitionFee,
      developmentFee: e.developmentFee,
      otherFees: e.otherFees,
      totalFee: e.totalAnnualFee,
      source: "FRA",
      sourceUrl: e.sourceUrl,
      fraInstituteId: e.fraInstituteId ?? null,
      fraStatus: e.fraStatus ?? null,
      fraMeetingDate: e.fraMeetingDate ?? null,
      // The FRA report says nothing about TFWS; `false` in fees.json means "not stated".
      tfwsAvailable: null,
      notes: e.note ?? null,
    });
  }
  return out;
}

/** RFC 4180-style CSV (quoted fields may contain commas, quotes and newlines). */
export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) records.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) records.push(row);
  const [head, ...body] = records;
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const amount = (s: string | undefined): number | null => {
  const t = (s ?? "").replace(/[₹,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

/**
 * Rows from the manually collected fee sheet (columns: code, tuition_fee, development_fee,
 * other_fees, total_fee, academic_year, source_url, notes; other columns are ignored).
 * Rows without a total are skipped (not yet found); rows with a total need a source URL.
 */
export function rowsFromManualCsv(text: string, problems: FeeProblem[]): FeeRow[] {
  const out: FeeRow[] = [];
  for (const r of parseCsv(text)) {
    const code = (r.code ?? "").padStart(5, "0");
    const total = amount(r.total_fee);
    if (total === null) continue;
    const tuition = amount(r.tuition_fee);
    const development = amount(r.development_fee);
    const other = amount(r.other_fees);
    if ([total, tuition, development, other].some((v) => Number.isNaN(v))) {
      problems.push({ collegeCode: code, problem: "an amount is not a number" });
      continue;
    }
    if (!/^https?:\/\//.test(r.source_url ?? "")) {
      problems.push({ collegeCode: code, problem: "total given without a source_url" });
      continue;
    }
    out.push({
      collegeCode: code,
      academicYear: r.academic_year || "2026-27",
      tuitionFee: tuition,
      developmentFee: development,
      otherFees: other,
      totalFee: total as number,
      source: "college",
      sourceUrl: r.source_url,
      fraInstituteId: null,
      fraStatus: null,
      fraMeetingDate: null,
      tfwsAvailable: null,
      notes: r.notes || null,
    });
  }
  return out;
}

/**
 * Merges FRA and manual rows (FRA wins for the same college and year; the manual row is reported)
 * and checks them: known college, academic year form, positive total, parts adding up to the total.
 * Rows with a problem are dropped and reported.
 */
export function mergeAndCheck(fra: FeeRow[], manual: FeeRow[], currentCodes: Set<string>, problems: FeeProblem[]): FeeRow[] {
  const byKey = new Map<string, FeeRow>();
  for (const r of [...fra, ...manual]) {
    const key = `${r.collegeCode}|${r.academicYear}`;
    if (byKey.has(key)) {
      problems.push({ collegeCode: r.collegeCode, problem: `duplicate ${r.academicYear} fee (${r.source} row ignored; FRA or first row kept)` });
      continue;
    }
    if (!currentCodes.has(r.collegeCode)) { problems.push({ collegeCode: r.collegeCode, problem: "not a current CAP college code" }); continue; }
    if (!/^\d{4}-\d{2}$/.test(r.academicYear)) { problems.push({ collegeCode: r.collegeCode, problem: `academic year "${r.academicYear}" is not like 2026-27` }); continue; }
    if (!(r.totalFee > 0)) { problems.push({ collegeCode: r.collegeCode, problem: "total is not positive" }); continue; }
    const parts = [r.tuitionFee, r.developmentFee, r.otherFees];
    if (parts.every((p) => p !== null) && parts.reduce((a, b) => a! + b!, 0) !== r.totalFee) {
      problems.push({ collegeCode: r.collegeCode, problem: `tuition + development + other = ${parts.reduce((a, b) => a! + b!, 0)}, total says ${r.totalFee}` });
      continue;
    }
    byKey.set(key, r);
  }
  return [...byKey.values()].sort((a, b) => a.collegeCode.localeCompare(b.collegeCode) || a.academicYear.localeCompare(b.academicYear));
}
