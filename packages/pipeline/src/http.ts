import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Hosts the pipeline may contact (AG-002 hard rule 4), plus the Fee Regulating Authority's
 * yearly fee portals (`ay26-27.mahafraportal.org`), linked from the CET Cell home page (#42).
 */
const ALLOWED_HOST = /^(fe\d{4}\.mahacet\.org|cappublicdocs\d{4}\.blob\.core\.windows\.net|ay\d{2}-\d{2}\.mahafraportal\.org)$/;
const MIN_GAP_MS = 1100;
const USER_AGENT = "mhtcet-cap-analysis data pipeline (research; polite, cached)";

let lastRequestAt = 0;

export function assertAllowed(url: string): URL {
  const u = new URL(url);
  if (u.protocol !== "https:" || !ALLOWED_HOST.test(u.hostname)) {
    throw new Error(`[HTTP] host not allowed: ${u.hostname}`);
  }
  return u;
}

async function politeGap(): Promise<void> {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/**
 * GET one URL, sequentially, at least ~1 s after the previous request, following redirects
 * only within the allowed hosts. Retries with backoff on network errors and 5xx.
 */
export async function politeGet(url: string, attempts = 3): Promise<{ status: number; body: Buffer; finalUrl: string }> {
  let current = assertAllowed(url).toString();
  for (let attempt = 1; ; attempt++) {
    try {
      for (let hop = 0; hop < 5; hop++) {
        await politeGap();
        const res = await fetch(current, { redirect: "manual", headers: { "user-agent": USER_AGENT } });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) throw new Error(`[HTTP] redirect without location from ${current}`);
          current = assertAllowed(new URL(loc, current).toString()).toString();
          continue;
        }
        if (res.status >= 500) throw new Error(`[HTTP] ${res.status} from ${current}`);
        return { status: res.status, body: Buffer.from(await res.arrayBuffer()), finalUrl: current };
      }
      throw new Error(`[HTTP] too many redirects from ${url}`);
    } catch (err) {
      if (attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

export type DownloadResult = "cached" | "downloaded" | "failed";

/** Download a PDF to `dest` unless it is already cached; verifies the %PDF header. */
export async function downloadPdf(url: string, dest: string): Promise<{ result: DownloadResult; detail?: string }> {
  try {
    const s = await stat(dest);
    if (s.size > 0) return { result: "cached" };
  } catch {
    // not cached
  }
  try {
    const { status, body } = await politeGet(url);
    if (status !== 200) return { result: "failed", detail: `HTTP ${status}` };
    if (body.subarray(0, 4).toString("latin1") !== "%PDF") return { result: "failed", detail: "not a PDF" };
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, body);
    return { result: "downloaded" };
  } catch (err) {
    return { result: "failed", detail: (err as Error).message };
  }
}
