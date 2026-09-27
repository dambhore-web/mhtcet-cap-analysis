import type pg from "pg";
import type { CutoffRow, College, Branch } from "@mhtcet/core";

export interface AppCache {
  year: number;
  /** Keyed by college code. */
  colleges: Map<string, College>;
  /** Keyed by choiceCode. */
  branches: Map<string, Branch>;
  /** Cutoff rows keyed by choiceCode — all lists (MH + AI) for the cache year. */
  cutoffsByChoiceCode: Map<string, CutoffRow[]>;
}

/**
 * Loads all colleges, branches and cutoff rows for `year` into memory at startup.
 * ~112k MH cutoff rows + a few thousand AI rows fit comfortably in RAM.
 *
 * Autonomous institutes have home_university = 'Autonomous Institute' in the DB.
 * We normalise that to null so the eligibility function treats them as State Level only.
 */
export async function loadCache(pool: pg.Pool, year: number): Promise<AppCache> {
  const colleges = new Map<string, College>();
  const branches = new Map<string, Branch>();
  const cutoffsByChoiceCode = new Map<string, CutoffRow[]>();

  const [colRes, brRes, cuRes] = await Promise.all([
    // SELECT * so the cache still loads before migration 002 adds district and college_type
    pool.query(`SELECT * FROM college`),
    pool.query(`SELECT authority, exam, choice_code, college_code, name FROM branch`),
    pool.query(
      `SELECT authority, exam, year, list, round, choice_code, college_code, section,
              seat_type, stage, closing_merit, closing_percentile, source, source_page
       FROM cutoff WHERE year = $1`,
      [year],
    ),
  ]);

  for (const r of colRes.rows) {
    const rawHU: string | null = r.home_university ?? null;
    colleges.set(r.code, {
      authority: r.authority,
      exam: r.exam,
      code: r.code,
      name: r.name,
      status: r.status ?? null,
      homeUniversity: rawHU === "Autonomous Institute" ? null : rawHU,
      totalIntake: r.total_intake ?? null,
      district: r.district ?? null,
      collegeType: r.college_type ?? null,
    });
  }

  for (const r of brRes.rows) {
    branches.set(r.choice_code, {
      authority: r.authority,
      exam: r.exam,
      choiceCode: r.choice_code,
      collegeCode: r.college_code,
      name: r.name,
    });
  }

  for (const r of cuRes.rows) {
    const row: CutoffRow = {
      authority: r.authority,
      exam: r.exam,
      year: r.year,
      list: r.list,
      round: r.round,
      choiceCode: r.choice_code,
      collegeCode: r.college_code,
      section: r.section,
      seatType: r.seat_type,
      stage: r.stage ?? "",
      closingMerit: r.closing_merit,
      closingPercentile: r.closing_percentile ?? null,
      sourceFile: r.source,
      sourcePage: r.source_page ?? null,
    };
    const bucket = cutoffsByChoiceCode.get(row.choiceCode);
    if (bucket) bucket.push(row);
    else cutoffsByChoiceCode.set(row.choiceCode, [row]);
  }

  console.log(
    `[cache] ${colleges.size} colleges · ${branches.size} branches · ` +
    `${cuRes.rows.length} cutoff rows (year ${year})`,
  );
  return { year, colleges, branches, cutoffsByChoiceCode };
}

/** Extract minority community from a college's status string (e.g. "Religious Minority - Muslim" → "Muslim"). */
export function minorityCommunity(status: string | null): string | null {
  if (!status) return null;
  const m = /Minority\s*-\s*(.+)$/.exec(status);
  return m?.[1]?.trim() ?? null;
}
