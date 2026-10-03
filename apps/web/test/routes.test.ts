import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Navigation rule 3 (docs/02-architecture/navigation.md): every route is reachable.
 * A route counts as reachable when some file other than App.tsx links to it.
 */
const SRC = join(__dirname, "..", "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
  });
}

const app = readFileSync(join(SRC, "App.tsx"), "utf8");
const routes = [...app.matchAll(/<Route\s+path="([^"*]+)"/g)].map((m) => "/" + m[1]);
const linkText = files(SRC)
  .filter((f) => !f.endsWith("App.tsx"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

/** Routes reached only by redirect or from outside the app. */
const EXEMPT = new Set(["/welcome"]);

describe("every route is linked from somewhere", () => {
  it("found the routes", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  for (const route of routes.filter((r) => !EXEMPT.has(r))) {
    it(route, () => {
      const base = route.replace(/\/:[^/]+.*$/, "");
      const pattern = route.includes(":")
        ? new RegExp("[`\"']" + base.replace(/\//g, "\\/") + "\\/(\\$\\{|[\"'`])")
        : new RegExp("[`\"']" + route.replace(/\//g, "\\/") + "(\\?[^\"'`]*)?[\"'`]");
      expect(pattern.test(linkText), `no link to ${route}`).toBe(true);
    });
  }
});
