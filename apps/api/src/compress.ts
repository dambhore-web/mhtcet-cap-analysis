import { gzip } from "node:zlib";
import { promisify } from "node:util";
import type { MiddlewareHandler } from "hono";

const gzipAsync = promisify(gzip);

/** Below this a response isn't worth compressing. */
const MIN_BYTES = 1024;

/**
 * Gzips JSON responses when the client accepts it (#27). A full rank-finder answer is ~1.7 MB
 * of JSON (every branch in the state, for the what-if slider) and ~70 KB gzipped, which matters
 * most on phones. Level 1 is ~4 ms for that size and runs on libuv's thread pool, off the event
 * loop. Streams (the assistant's SSE) are left alone.
 */
export const compressJson: MiddlewareHandler = async (c, next) => {
  await next();
  const res = c.res;
  if (!/\bgzip\b/.test(c.req.header("accept-encoding") ?? "")) return;
  if (!(res.headers.get("content-type") ?? "").startsWith("application/json")) return;
  if (res.headers.has("content-encoding") || !res.body) return;

  const body = Buffer.from(await res.arrayBuffer());
  const headers = new Headers(res.headers);
  headers.append("vary", "accept-encoding");
  if (body.length < MIN_BYTES) {
    c.res = new Response(body, { status: res.status, headers });
    return;
  }
  const zipped = await gzipAsync(body, { level: 1 });
  headers.set("content-encoding", "gzip");
  headers.set("content-length", String(zipped.length));
  c.res = new Response(zipped, { status: res.status, headers });
};
