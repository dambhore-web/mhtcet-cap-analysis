import type { Context } from "hono";
import type { AppCache } from "../startup.ts";

/** GET /api/branches — sorted list of every unique branch name in the cache. */
export function getBranches(c: Context, cache: AppCache) {
  const names = [...new Set([...cache.branches.values()].map((b) => b.name))].sort(
    (a, b) => a.localeCompare(b),
  );
  return c.json({ branches: names });
}
