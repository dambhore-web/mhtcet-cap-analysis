import type { MiddlewareHandler } from "hono";

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

/** Returns true if the request is allowed, false if the rate limit is exceeded. */
export function checkRateLimit(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

/**
 * The client IP as seen by the proxies we trust. Each proxy appends the address it received the
 * request from to X-Forwarded-For, so only the last TRUSTED_PROXY_HOPS entries were written by our
 * infrastructure; anything to their left was sent by the client and can be forged (the old code
 * took the first entry, so any client could dodge the rate limit with a made-up header).
 * Railway's edge is one hop (the default). CF-Connecting-IP is used only when TRUST_CLOUDFLARE=1,
 * i.e. when Cloudflare actually sits in front; otherwise it too is client-controlled.
 */
export function clientIp(
  req: { header: (name: string) => string | undefined },
  env: { TRUSTED_PROXY_HOPS?: string; TRUST_CLOUDFLARE?: string } = process.env,
): string {
  if (env.TRUST_CLOUDFLARE === "1") {
    const cf = req.header("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }
  const hops = Math.max(1, Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1);
  const chain = (req.header("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain.length ? chain[Math.max(0, chain.length - hops)] : "unknown";
}

/**
 * Per-IP request budget for a group of routes (fixed window). Protects the in-memory data from
 * bulk scraping (threat T2) and the server from request floods; ordinary use stays far below it.
 */
export function rateLimit(name: string, windowMs: number, max: number): MiddlewareHandler {
  return async (c, next) => {
    // Load tests and end-to-end tests drive the API from one machine; they switch the budgets off.
    if (process.env.RATE_LIMITS === "off") return next();
    const ip = clientIp(c.req);
    if (!checkRateLimit(`${name}:${ip}`, windowMs, max)) {
      c.header("retry-after", String(Math.ceil(windowMs / 1000)));
      return c.json({ error: "rate_limited", message: "Too many requests. Please wait a minute and try again." }, 429);
    }
    await next();
  };
}

// Prune stale buckets every 10 minutes to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000).unref();
