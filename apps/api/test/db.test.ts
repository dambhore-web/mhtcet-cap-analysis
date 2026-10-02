import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type pg from "pg";
import { watchIdleErrors } from "../src/db.ts";

describe("database pool", () => {
  it("logs a dropped idle connection instead of crashing the API", () => {
    const pool = new EventEmitter() as unknown as pg.Pool;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    watchIdleErrors(pool);
    const err = Object.assign(new Error("write ECONNABORTED"), { code: "ECONNABORTED" });
    // without a listener, EventEmitter throws on "error": this would be the crash
    expect(() => (pool as unknown as EventEmitter).emit("error", err)).not.toThrow();
    expect(log.mock.calls[0][0]).toContain('"event":"db_idle_error"');
    expect(log.mock.calls[0][0]).toContain("ECONNABORTED");
    log.mockRestore();
  });
});
