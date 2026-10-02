// Checks a Supabase project's sign-in setup from the outside, with the public anon key only (#131).
// Usage (from apps/web): node --env-file=.env.local scripts/check-supabase.mjs
//   or: npm run check:supabase
// Run it on staging now and on production during the rollout. Exits 1 if any check fails.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (apps/web/.env.local).");
  process.exit(2);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

const settings = await (await fetch(`${url}/auth/v1/settings`, { headers })).json();
const providers = Object.entries(settings.external ?? {}).filter(([, on]) => on).map(([p]) => p);
check("Google sign-in is on", providers.includes("google"), `enabled: ${providers.join(", ") || "none"}`);
check("Email sign-up is off (Google only)", !providers.includes("email"), "Authentication → Sign In / Providers → Email: disable");
check("Phone sign-up is off", !providers.includes("phone"), "Authentication → Sign In / Providers → Phone: disable");

const read = await fetch(`${url}/rest/v1/user_store?select=key&limit=1`, { headers });
check("Signed-out visitors can't read user_store", read.status === 401 || read.status === 403, `HTTP ${read.status}`);

const write = await fetch(`${url}/rest/v1/rpc/put_user_item`, {
  method: "POST",
  headers,
  body: JSON.stringify({ p_key: "list", p_value: [], p_updated_at: new Date().toISOString() }),
});
check("Signed-out visitors can't save through put_user_item", write.status === 401 || write.status === 403, `HTTP ${write.status}`);

const insert = await fetch(`${url}/rest/v1/user_store`, {
  method: "POST",
  headers,
  body: JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000000", key: "list", value: [], updated_at: new Date().toISOString() }),
});
check("Signed-out visitors can't insert rows directly", insert.status === 401 || insert.status === 403, `HTTP ${insert.status}`);

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  (${r.detail})`}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
