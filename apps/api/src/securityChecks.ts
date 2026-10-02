/**
 * Settings a production API must have (#131). Logged once at startup so a missing one shows up in
 * the Railway logs instead of silently weakening the API. Empty outside production.
 */
export function securityWarnings(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const out: string[] = [];
  if (!env.CORS_ORIGINS?.trim()) out.push("CORS_ORIGINS is not set: any website can call this API (O1)");
  if (!env.DATABASE_CA_CERT?.trim()) out.push("DATABASE_CA_CERT is not set: the database certificate is not verified (O3)");
  if (/\/\/postgres[.:]/.test(env.DATABASE_URL ?? "")) out.push("DATABASE_URL uses the postgres owner role: use the SELECT-only compass_api role (O2)");
  return out;
}
