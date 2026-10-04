// fetch for the web build's API calls (sitemap, prerendered pages), retried while the API is down.
//
// On Railway the web and the API deploy from the same push: the web build can ask the API for data
// while the API is restarting and get a 502, which failed the whole build (2026-10-04). Gateway
// errors and connection failures are retried for about four minutes; any other answer is returned
// as it is, so a real error (404, 500) still fails the build at once.
// Usage: import { fetchApi } from "./fetch-api.mjs"; const res = await fetchApi(url);

/** Statuses that mean "the API isn't there yet", not "the API answered with an error". */
const RETRY_STATUS = new Set([502, 503, 504]);

export async function fetchApi(url, { tries = 16, delayMs = 15000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fetchFn = fetch } = {}) {
  for (let attempt = 1; ; attempt++) {
    let why;
    try {
      const res = await fetchFn(url);
      if (!RETRY_STATUS.has(res.status)) return res;
      why = `answered ${res.status}`;
      if (attempt >= tries) return res;
    } catch (err) {
      why = `failed (${err instanceof Error ? err.message : String(err)})`;
      if (attempt >= tries) throw err;
    }
    console.log(`[api] ${url} ${why}; retrying in ${delayMs / 1000}s (${attempt}/${tries - 1})`);
    await sleep(delayMs);
  }
}
