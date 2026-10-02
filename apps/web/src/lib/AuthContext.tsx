import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { removeKey } from "./storage";
import { clearSyncedLocally, startSync, supabaseBackend, type SyncSession, type SyncStatus } from "./sync";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  plan: "free" | "paid";
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  /** False when this build has no Supabase settings: sign-in isn't offered. */
  configured: boolean;
  syncStatus: SyncStatus | null;
  /** Starts Google sign-in; the browser leaves the app and comes back to /signin. */
  signIn(returnTo?: string): Promise<void>;
  /** Saves any pending change, signs out and removes the synced details from this browser. */
  signOut(): Promise<void>;
  /** Deletes everything saved to the account (this browser keeps its copy). */
  deleteAccountData(): Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Where to go after Google sends the student back. */
export const RETURN_KEY = "compass_signin_return";
/** The stub session kept before sign-in existed. */
const LEGACY_SESSION_KEY = "compass_session_v1";

function toUser(session: Session | null): AuthUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  const name = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null;
  // payments aren't built yet (#21): every account is free
  return { id: u.id, email: u.email ?? "", name, plan: "free" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const sync = useRef<SyncSession | null>(null);

  useEffect(() => {
    removeKey(LEGACY_SESSION_KEY);
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setUser(toUser(data.session));
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) setUser(toUser(session));
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  // sync while signed in, one session per account
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!supabase || !userId) return;
    const s = startSync(supabaseBackend(supabase, userId), setSyncStatus);
    sync.current = s;
    return () => {
      s.stop();
      if (sync.current === s) sync.current = null;
      setSyncStatus(null);
    };
  }, [supabase, userId]);

  const signIn = useCallback(
    async (returnTo?: string) => {
      if (!supabase) throw new Error("Sign-in is not configured");
      try {
        sessionStorage.setItem(RETURN_KEY, returnTo ?? "/profile");
      } catch {
        /* private mode: lands on the profile */
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/signin` },
      });
      if (error) throw error;
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await sync.current?.flush().catch(() => undefined);
    sync.current?.stop();
    sync.current = null;
    await supabase.auth.signOut();
    // the details are safe in the account; don't leave them on a shared computer
    clearSyncedLocally();
    setUser(null);
  }, [supabase]);

  const deleteAccountData = useCallback(async () => {
    if (!supabase || !userId) return;
    sync.current?.stop();
    sync.current = null;
    await supabaseBackend(supabase, userId).deleteAll();
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase, userId]);

  return (
    <Ctx.Provider value={{ user, loading, configured: !!supabase, syncStatus, signIn, signOut, deleteAccountData }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
