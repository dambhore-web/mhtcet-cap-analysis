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

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dbSsl } from "../src/db.ts";
import { securityWarnings } from "../src/securityChecks.ts";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n";

describe("database TLS (#131 O3)", () => {
  it("stays unverified without a CA, as before", () => {
    expect(dbSsl({})).toEqual({ rejectUnauthorized: false });
  });

  it("verifies against a CA given as PEM text, including \n-escaped text from an env panel", () => {
    expect(dbSsl({ DATABASE_CA_CERT: PEM })).toEqual({ ca: PEM.trim(), rejectUnauthorized: true });
    expect(dbSsl({ DATABASE_CA_CERT: PEM.replace(/\n/g, "\\n") }).ca).toBe(PEM.trim());
  });

  it("reads a CA file path, and rejects a file that isn't a certificate", () => {
    const dir = mkdtempSync(join(tmpdir(), "ca-"));
    writeFileSync(join(dir, "prod-ca.crt"), PEM);
    writeFileSync(join(dir, "bad.crt"), "not a cert");
    expect(dbSsl({ DATABASE_CA_CERT: join(dir, "prod-ca.crt") })).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(() => dbSsl({ DATABASE_CA_CERT: join(dir, "bad.crt") })).toThrow(/not a PEM certificate/);
  });
});

describe("startup security warnings (#131)", () => {
  it("are silent outside production", () => {
    expect(securityWarnings({})).toEqual([]);
  });

  it("name each missing production setting", () => {
    const w = securityWarnings({ NODE_ENV: "production", DATABASE_URL: "postgresql://postgres.ref:pw@host:5432/postgres" });
    expect(w.join(" | ")).toMatch(/CORS_ORIGINS.*\|.*DATABASE_CA_CERT.*\|.*compass_api/);
  });

  it("are quiet when production is set up", () => {
    expect(securityWarnings({ NODE_ENV: "production", CORS_ORIGINS: "https://compass.example", DATABASE_CA_CERT: "x", DATABASE_URL: "postgresql://compass_api.ref:pw@host:5432/postgres" })).toEqual([]);
  });
});
