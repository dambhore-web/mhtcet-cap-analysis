import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { createApp } from "../src/app.ts";
import { demoCache } from "../src/demo/demoCache.ts";
import { demoAssistant } from "../src/demo/demoAssistant.ts";

const emptyPool = { query: async () => ({ rows: [] }) } as unknown as pg.Pool;
const app = createApp(demoCache(), emptyPool, { assistantClient: demoAssistant });

const find = (headers: Record<string, string>) =>
  app.request("http://localhost/api/rank-finder", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ merit: 5200, gender: "M" }),
  });

describe("JSON compression", () => {
  it("gzips a large JSON response when the client accepts gzip, and it decodes to the same data", async () => {
    const plain = await (await find({})).json();
    const res = await find({ "Accept-Encoding": "gzip, br" });
    expect(res.headers.get("content-encoding")).toBe("gzip");
    expect(res.headers.get("vary")).toMatch(/accept-encoding/i);
    const zipped = Buffer.from(await res.arrayBuffer());
    expect(Number(res.headers.get("content-length"))).toBe(zipped.length);
    expect(JSON.parse(gunzipSync(zipped).toString("utf8"))).toEqual(plain);
  });

  it("sends plain JSON to clients that don't accept gzip", async () => {
    const res = await find({});
    expect(res.headers.get("content-encoding")).toBeNull();
    expect((await res.json()).options.length).toBeGreaterThan(0);
  });

  it("leaves small responses and the assistant's event stream uncompressed", async () => {
    const health = await app.request("http://localhost/api/health", { headers: { "Accept-Encoding": "gzip" } });
    expect(health.headers.get("content-encoding")).toBeNull();
    const sse = await app.request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip" },
      body: JSON.stringify({ messages: [{ role: "user", content: "What does GOPENH mean?" }] }),
    });
    expect(sse.headers.get("content-type")).toMatch(/event-stream/);
    expect(sse.headers.get("content-encoding")).toBeNull();
    expect(await sse.text()).toContain('"done":true');
  });
});
