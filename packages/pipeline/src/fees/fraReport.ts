/**
 * Parser for the Fee Regulating Authority (FRA) "Fee Approved" report: the HTML table that
 * `outer.php?q=fee_search_report` loads from `admin/reports/ajax/get_report_ajax.php`.
 * Columns (2025-26 and 2026-27 reports): Sr. No., Inst ID, Inst Name, District, Stream, Status,
 * Date of Meeting, Tuition Fee, Development Fee, Total Fee. The portal states no TFWS data and no
 * order reference or URL.
 */

export interface FraFeeRow {
  /** FRA institute id as printed, e.g. EN6007, EN16006, MC5151. */
  instId: string;
  name: string;
  district: string;
  stream: string;
  /** e.g. "Approved", "No Upward Revision", "Interim Order of High Court". */
  status: string;
  /** Date of the FRA meeting, ISO yyyy-mm-dd; null when not printed. */
  meetingDate: string | null;
  tuitionFee: number;
  developmentFee: number;
  totalFee: number;
}

export interface FraReport {
  /** "2026-27" from the title "… for Academic Year 2026-27"; null when the title is missing. */
  academicYear: string | null;
  rows: FraFeeRow[];
  /** Data rows that could not be read, as "row N: reason". */
  issues: string[];
}

const EXPECTED_HEADER = ["Sr. No.", "Inst ID", "Inst Name", "District", "Stream", "Status", "Date of Meeting", "Tuition Fee", "Development Fee", "Total Fee"];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function cellText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#39|[a-z]+);/g, (m, e: string) => ENTITIES[e] ?? m)
    .replace(/�/g, "'") // the 2025-26 report prints one apostrophe as an invalid byte
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoDate(s: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function toAmount(s: string): number | null {
  if (!/^\d[\d,]*$/.test(s)) return null;
  return Number(s.replace(/,/g, ""));
}

export function parseFraReport(html: string): FraReport {
  const body = html.replace(/<!--[\s\S]*?-->/g, ""); // the report comments out its "Review" columns
  const title = /Academic Year\s+(\d{4}-\d{2})/i.exec(body);
  const rows: FraFeeRow[] = [];
  const issues: string[] = [];
  const trs = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => cellText(c[1])));
  if (!trs.length) return { academicYear: title?.[1] ?? null, rows, issues: ["no table rows"] };
  const header = trs[0];
  if (header.join("|") !== EXPECTED_HEADER.join("|")) issues.push(`unexpected header: ${header.join(" | ")}`);
  trs.slice(1).forEach((cells, i) => {
    const where = `row ${i + 1}`;
    if (cells.length !== EXPECTED_HEADER.length) return void issues.push(`${where}: ${cells.length} cells`);
    const [, instId, name, district, stream, status, date, tuition, development, total] = cells;
    const t = toAmount(tuition);
    const d = toAmount(development);
    const tot = toAmount(total);
    if (!/^[A-Z]+\d+$/.test(instId)) return void issues.push(`${where}: bad institute id "${instId}"`);
    if (t === null || d === null || tot === null) return void issues.push(`${where} (${instId}): non-numeric fee`);
    rows.push({ instId, name, district, stream, status, meetingDate: toIsoDate(date), tuitionFee: t, developmentFee: d, totalFee: tot });
  });
  return { academicYear: title?.[1] ?? null, rows, issues };
}
