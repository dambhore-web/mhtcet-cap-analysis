import type { Context } from "hono";
import type pg from "pg";
import type { AppCache } from "../startup.ts";
import type { FeeIndex } from "../feeIndex.ts";

/**
 * GET /api/meta: what data the API is serving, for "Where our numbers come from" (#114).
 * Counts come from the loaded cache; load history comes from ingest_run when the DB has it.
 */
export async function getMeta(c: Context, cache: AppCache, pool: pg.Pool, fees: FeeIndex) {
  const byListRound = new Map<string, { list: string; round: string; rows: number; files: Set<string> }>();
  let cutoffRows = 0;
  for (const rows of cache.cutoffsByChoiceCode.values()) {
    for (const r of rows) {
      cutoffRows++;
      const key = `${r.list}|${r.round}`;
      const e = byListRound.get(key) ?? { list: r.list, round: r.round, rows: 0, files: new Set<string>() };
      e.rows++;
      if (r.sourceFile) e.files.add(r.sourceFile);
      byListRound.set(key, e);
    }
  }

  let loads: { id: string; startedAt: string; finishedAt: string | null; status: string }[] = [];
  try {
    const res = await pool.query<{ id: string; started_at: Date; finished_at: Date | null; status: string }>(
      "SELECT id, started_at, finished_at, status FROM ingest_run ORDER BY started_at DESC LIMIT 5",
    );
    loads = res.rows.map((r) => ({
      id: r.id,
      startedAt: new Date(r.started_at).toISOString(),
      finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
      status: r.status,
    }));
  } catch {
    // no load history available (demo mode or no access)
  }

  return c.json({
    year: cache.year,
    colleges: cache.colleges.size,
    branches: cache.branches.size,
    cutoffRows,
    lists: [...byListRound.values()]
      .sort((a, b) => a.list.localeCompare(b.list) || a.round.localeCompare(b.round))
      .map((e) => ({ list: e.list, round: e.round, rows: e.rows, files: [...e.files].sort() })),
    districtsLoaded: [...cache.colleges.values()].filter((c) => c.district).length,
    fees: { colleges: fees.byCollege.size, verified: fees.verified, source: fees.source },
    loads,
  });
}
