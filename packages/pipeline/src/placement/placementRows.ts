import { rowProblems, type NirfPlacement, type NirfPlacementRow } from "../parse/nirf.ts";

/** One NIRF data PDF of a college, parsed. */
export interface ParsedNirfDoc {
  collegeCode: string;
  sourceUrl: string;
  parsed: NirfPlacement;
}

export interface PlacementRow extends NirfPlacementRow {
  collegeCode: string;
  /** NIRF edition the figures come from, e.g. 2026 (its latest batch graduated in 2024-25). */
  nirfYear: number;
  nirfCategory: string;
  nirfInstituteId: string;
  sourceUrl: string;
}

export interface PlacementProblem {
  collegeCode: string;
  sourceUrl: string;
  problem: string;
}

/** NIRF ID letter → ranking category. Only categories whose UG 4-year table covers B.E./B.Tech are used. */
const CATEGORIES: Record<string, { name: string; priority: number }> = {
  E: { name: "Engineering", priority: 3 },
  U: { name: "University", priority: 2 },
  O: { name: "Overall", priority: 1 },
};

/** Category of a NIRF institute ID such as "IR-E-C-12345" (null for categories not used). */
export function nirfCategory(instituteId: string): { name: string; priority: number } | null {
  const m = instituteId.match(/^IR-([A-Z])-/);
  return m ? CATEGORIES[m[1]] ?? null : null;
}

/** NIRF edition from the latest graduating batch: batches up to 2024-25 are in NIRF 2026. */
export function nirfEdition(rows: NirfPlacementRow[]): number | null {
  const ends = rows.map((r) => Number(r.graduationYear.slice(0, 4)) + 1);
  return ends.length ? Math.max(...ends) + 1 : null;
}

/**
 * Placement rows per college from its NIRF PDFs. For each graduating batch the figures of the
 * newest NIRF edition win (institutions revise earlier years), and within an edition the
 * Engineering category wins over University and Overall. Rows that cannot be right are skipped
 * and reported. Pure.
 */
export function buildPlacementRows(docs: ParsedNirfDoc[], problems: PlacementProblem[]): PlacementRow[] {
  const best = new Map<string, { row: PlacementRow; rank: number }>();
  for (const d of docs) {
    const id = d.parsed.instituteId;
    const cat = id ? nirfCategory(id) : null;
    if (!id || !cat) {
      problems.push({ collegeCode: d.collegeCode, sourceUrl: d.sourceUrl, problem: id ? `category of ${id} not used` : "no NIRF institute ID" });
      continue;
    }
    const edition = nirfEdition(d.parsed.rows);
    if (!edition) {
      problems.push({ collegeCode: d.collegeCode, sourceUrl: d.sourceUrl, problem: "no UG 4-year placement table" });
      continue;
    }
    for (const r of d.parsed.rows) {
      const p = rowProblems(r);
      if (p.length) {
        problems.push({ collegeCode: d.collegeCode, sourceUrl: d.sourceUrl, problem: `${r.graduationYear}: ${p.join(", ")}` });
        continue;
      }
      const key = `${d.collegeCode}|${r.graduationYear}`;
      const rank = edition * 10 + cat.priority;
      const prev = best.get(key);
      if (prev && prev.rank >= rank) continue;
      best.set(key, {
        rank,
        row: { ...r, collegeCode: d.collegeCode, nirfYear: edition, nirfCategory: cat.name, nirfInstituteId: id, sourceUrl: d.sourceUrl },
      });
    }
  }
  return [...best.values()]
    .map((b) => b.row)
    .sort((a, b) => a.collegeCode.localeCompare(b.collegeCode) || a.graduationYear.localeCompare(b.graduationYear));
}
