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
  /**
   * State (MH) cutoff rows of the years before `year`, keyed by choiceCode, for year-on-year trends.
   * Kept separate so everything else keeps working on the cache year only.
   */
  history: Map<string, HistoryRow[]>;
  /**
   * CAP seat matrix of the cache year: seats per seat type, keyed by choiceCode. Only intake pools
   * (state, minority, all-india, institute) and supernumerary seats (EWS, TFWS); the shared PWD/DEF
   * "common reserved" counts are left out. Empty when the table is missing.
   */
  seats: Map<string, Map<string, number>>;
  /**
   * Fees from the `fee` table (latest academic year per college), in the fees.json entry shape.
   * Undefined when the table is missing or empty; the API then falls back to the bundled fees.json.
   */
  fees?: Record<string, unknown>;
  /**
   * NIRF placement figures per college (UG 4-year programs), oldest batch first, keyed by college
   * code. Empty when the table is missing. Optional so test caches can leave it out.
   */
  placement?: Map<string, PlacementRow[]>;
  /** Figures colleges publish on their own websites, keyed by college code (migration 006). */
  placementClaims?: Map<string, PlacementClaimRow>;
}

/** A college's own latest placement figures, as read from its website (not verified). */
export interface PlacementClaimRow {
  year: string | null;
  highest: number | null;
  average: number | null;
  median: number | null;
  placedPct: number | null;
  crawledAt: string;
  /** Where each figure came from: the page and the sentence it was read from. */
  claims: Array<{ metric: string; value: number; year: string | null; snippet: string; sourceUrl: string }>;
}

/** One graduating batch of a college from the `placement` table (migration 005). */
export interface PlacementRow {
  graduationYear: string;
  graduates: number;
  placed: number | null;
  medianSalary: number | null;
  higherStudies: number | null;
  nirfYear: number;
  nirfCategory: string;
  sourceUrl: string;
}

/**
 * Loads all colleges, branches and cutoff rows for `year` into memory at startup.
 * ~112k MH cutoff rows + a few thousand AI rows fit comfortably in RAM.
 *
 * Autonomous institutes have home_university = 'Autonomous Institute' in the DB.
 * We normalise that to null so the eligibility function treats them as State Level only.
 */
/** One earlier-year state cutoff: only what the year-on-year view needs. */
export interface HistoryRow {
  year: number;
  round: string;
  seatType: string;
  section: string;
  stage: string;
  closingMerit: number;
  closingPercentile: number | null;
}

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

  const history = await loadHistory(pool, year);
  const seats = await loadSeats(pool, year);
  const fees = await loadFees(pool, colleges);
  const placement = await loadPlacement(pool);
  const placementClaims = await loadPlacementClaims(pool);

  console.log(
    `[cache] ${colleges.size} colleges · ${branches.size} branches · ` +
    `${cuRes.rows.length} cutoff rows (year ${year}) · ${[...history.values()].reduce((n, r) => n + r.length, 0)} earlier-year rows · ` +
    `seat matrix for ${seats.size} branches · fees ${fees ? `${Object.keys(fees).length} from the fee table` : "from fees.json"} · ` +
    `placement for ${placement.size} colleges (NIRF) and ${placementClaims.size} (college sites)`,
  );
  return { year, colleges, branches, cutoffsByChoiceCode, history, seats, fees, placement, placementClaims };
}

/** Seat matrix of `year` (migration 003), keyed by choiceCode then seat type. */
async function loadSeats(pool: pg.Pool, year: number): Promise<Map<string, Map<string, number>>> {
  const seats = new Map<string, Map<string, number>>();
  try {
    const { rows } = await pool.query(
      `SELECT choice_code, seat_type, seats FROM seat_matrix
       WHERE year = $1 AND pool <> 'common-reserved'`,
      [year],
    );
    for (const r of rows) {
      const bySeat = seats.get(r.choice_code) ?? new Map<string, number>();
      bySeat.set(r.seat_type, (bySeat.get(r.seat_type) ?? 0) + r.seats);
      seats.set(r.choice_code, bySeat);
    }
  } catch (err) {
    // Before migration 003 the table does not exist; seat counts are simply not shown.
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: "seat_matrix_unavailable", error: (err as Error).message }));
  }
  return seats;
}

/** Sanctioned intake of a branch: every seat except the supernumerary EWS and TFWS seats. */
export function branchIntake(bySeat: Map<string, number> | undefined): number | null {
  if (!bySeat?.size) return null;
  let total = 0;
  for (const [seatType, n] of bySeat) if (seatType !== "EWS" && seatType !== "TFWS") total += n;
  return total;
}

/** State (MH) cutoffs of the years before `year` (2023–2025 for CAP 2026), keyed by choiceCode. */
async function loadHistory(pool: pg.Pool, year: number): Promise<Map<string, HistoryRow[]>> {
  const history = new Map<string, HistoryRow[]>();
  const { rows } = await pool.query(
    `SELECT year, round, choice_code, section, seat_type, stage, closing_merit, closing_percentile
     FROM cutoff WHERE list = 'MH' AND year < $1 AND year >= $1 - 3`,
    [year],
  );
  for (const r of rows) {
    const row: HistoryRow = {
      year: r.year, round: r.round, seatType: r.seat_type, section: r.section, stage: r.stage ?? "",
      closingMerit: r.closing_merit, closingPercentile: r.closing_percentile == null ? null : Number(r.closing_percentile),
    };
    const bucket = history.get(r.choice_code);
    if (bucket) bucket.push(row);
    else history.set(r.choice_code, [row]);
  }
  return history;
}

/** Latest academic year's fee per college from the `fee` table (migration 004), keyed by college code. */
async function loadFees(pool: pg.Pool, colleges: Map<string, College>): Promise<Record<string, unknown> | undefined> {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (college_code) college_code, academic_year, tuition_fee, development_fee, other_fees, total_fee,
              source, source_url, fra_institute_id, fra_status, fra_meeting_date, tfws_available
       FROM fee WHERE authority = 'MH-CET-CELL' ORDER BY college_code, academic_year DESC`,
    );
    if (!rows.length) return undefined;
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      out[r.college_code] = {
        name: colleges.get(r.college_code)?.name ?? r.college_code,
        collegeCode: r.college_code,
        tuitionFee: r.tuition_fee,
        developmentFee: r.development_fee,
        otherFees: r.other_fees,
        totalAnnualFee: r.total_fee,
        tfwsAvailable: r.tfws_available === true,
        tfwsSeats: null,
        fraOrderRef: null,
        fraOrderUrl: null,
        sampleOnly: false,
        academicYear: r.academic_year,
        source: r.source,
        fraInstituteId: r.fra_institute_id ?? undefined,
        fraStatus: r.fra_status ?? undefined,
        sourceUrl: r.source_url,
      };
    }
    return out;
  } catch (err) {
    // Before migration 004 the table does not exist; fees.json is used instead.
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: "fees_table_unavailable", error: (err as Error).message }));
    return undefined;
  }
}

/** NIRF placement rows (migration 005), keyed by college code, oldest batch first. */
async function loadPlacement(pool: pg.Pool): Promise<Map<string, PlacementRow[]>> {
  const placement = new Map<string, PlacementRow[]>();
  try {
    const { rows } = await pool.query(
      `SELECT college_code, graduation_year, graduates, placed, median_salary, higher_studies, nirf_year, nirf_category, source_url
       FROM placement WHERE authority = 'NIRF' AND program = 'UG4' ORDER BY college_code, graduation_year`,
    );
    for (const r of rows) {
      const row: PlacementRow = {
        graduationYear: r.graduation_year, graduates: r.graduates, placed: r.placed, medianSalary: r.median_salary,
        higherStudies: r.higher_studies, nirfYear: r.nirf_year, nirfCategory: r.nirf_category, sourceUrl: r.source_url,
      };
      const bucket = placement.get(r.college_code);
      if (bucket) bucket.push(row);
      else placement.set(r.college_code, [row]);
    }
  } catch (err) {
    // Before migration 005 the table does not exist; placement is simply not shown.
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: "placement_unavailable", error: (err as Error).message }));
  }
  return placement;
}

/** Placement figures from colleges' own websites (migration 006), keyed by college code. */
async function loadPlacementClaims(pool: pg.Pool): Promise<Map<string, PlacementClaimRow>> {
  const out = new Map<string, PlacementClaimRow>();
  try {
    const { rows } = await pool.query(
      `SELECT college_code, year, highest, average, median, placed_pct, claims, crawled_at FROM placement_claim`,
    );
    for (const r of rows) {
      out.set(r.college_code, {
        year: r.year, highest: r.highest, average: r.average, median: r.median,
        placedPct: r.placed_pct == null ? null : Number(r.placed_pct),
        crawledAt: r.crawled_at instanceof Date ? r.crawled_at.toISOString().slice(0, 10) : String(r.crawled_at),
        claims: r.claims,
      });
    }
  } catch (err) {
    // Before migration 006 the table does not exist; these figures are simply not shown.
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: "placement_claims_unavailable", error: (err as Error).message }));
  }
  return out;
}

/** Extract minority community from a college's status string (e.g. "Religious Minority - Muslim" → "Muslim"). */
export function minorityCommunity(status: string | null): string | null {
  if (!status) return null;
  const m = /Minority\s*-\s*(.+)$/.exec(status);
  return m?.[1]?.trim() ?? null;
}
