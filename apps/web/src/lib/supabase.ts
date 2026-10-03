import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase client for sign-in and the student's own data (#15), or null when the build has no
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: then the app runs as before, everything in this browser.
 * The anon (publishable) key is public by design; row-level security protects the data.
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  client = url && key ? createClient(url, key, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } }) : null;
  return client;
}
