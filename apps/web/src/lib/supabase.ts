import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase client for sign-in and the student's own data (#15), or null when the build has no
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: then the app runs as before, everything in this browser.
 * The anon (publishable) key is public by design; row-level security protects the data.
 *
 * The library is about a third of the app's code, and most visitors never sign in, so it is loaded
 * on demand (a separate chunk): when this browser holds a saved sign-in, on the page Google sends
 * the student back to, or when they tap "Sign in" (AuthContext).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Whether this build offers sign-in at all. */
export const supabaseConfigured = !!(url && key);

let client: Promise<SupabaseClient | null> | undefined;

export function loadSupabase(): Promise<SupabaseClient | null> {
  if (!client) {
    client = supabaseConfigured
      ? import("@supabase/supabase-js").then(({ createClient }) =>
          createClient(url!, key!, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } }),
        )
      : Promise.resolve(null);
  }
  return client;
}

/**
 * Whether the client is needed as the app starts: a saved session in this browser (supabase-js
 * keeps it as sb-<project>-auth-token), or a return from Google sign-in (/signin with ?code= or
 * ?error=). Otherwise nobody is signed in, and nothing needs loading until they sign in.
 */
export function supabaseNeededAtStart(storage: Pick<Storage, "length" | "key"> | null, location: Pick<Location, "pathname" | "search">): boolean {
  return supabaseConfigured && signedInOrReturning(storage, location);
}

/** A saved session in this browser, or a return from Google sign-in (the test of supabaseNeededAtStart). */
export function signedInOrReturning(storage: Pick<Storage, "length" | "key"> | null, location: Pick<Location, "pathname" | "search">): boolean {
  if (location.pathname === "/signin" && /[?&](code|error)=/.test(location.search)) return true;
  try {
    for (let i = 0; storage && i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch {
    /* storage blocked: no saved session to find */
  }
  return false;
}
