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

/** Extract the real client IP, preferring proxy headers set by Railway/Cloudflare. */
export function clientIp(req: { header: (name: string) => string | undefined }): string {
  return (
    req.header("cf-connecting-ip") ??
    req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// Prune stale buckets every 10 minutes to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000).unref();
