import { describe, expect, it } from "vitest";
import { fetchApi } from "../scripts/fetch-api.mjs";

const answer = (status: number) => new Response("{}", { status });
const noWait = async () => {};

describe("the web build's API calls (fetchApi)", () => {
  it("waits out a restarting API: retries 502/503/504 until it answers", async () => {
    const seen: number[] = [];
    const replies = [502, 503, 504, 200];
    const res = await fetchApi("https://api.example/api/sitemap", {
      sleep: noWait,
      fetchFn: async () => {
        const s = replies.shift()!;
        seen.push(s);
        return answer(s);
      },
    });
    expect(res.status).toBe(200);
    expect(seen).toEqual([502, 503, 504, 200]);
  });

  it("retries a connection that fails, then gives up with the error", async () => {
    let calls = 0;
    await expect(
      fetchApi("https://api.example/x", { tries: 3, sleep: noWait, fetchFn: async () => { calls++; throw new Error("ECONNREFUSED"); } }),
    ).rejects.toThrow("ECONNREFUSED");
    expect(calls).toBe(3);
  });

  it("returns a real error at once, so the build still fails on it", async () => {
    let calls = 0;
    const res = await fetchApi("https://api.example/x", { sleep: noWait, fetchFn: async () => { calls++; return answer(404); } });
    expect(res.status).toBe(404);
    expect(calls).toBe(1);
  });

  it("returns the last gateway error after the last try", async () => {
    let calls = 0;
    const res = await fetchApi("https://api.example/x", { tries: 4, sleep: noWait, fetchFn: async () => { calls++; return answer(502); } });
    expect(res.status).toBe(502);
    expect(calls).toBe(4);
  });
});
