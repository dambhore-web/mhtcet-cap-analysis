import { createContext, useContext, useState, type ReactNode } from "react";
import { readJson, removeKey, isRecord, isStr } from "./storage";

export interface AuthUser {
  id: string;
  email: string;
  plan: "free" | "paid";
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  signIn(): Promise<void>;
  signOut(): void;
}

const Ctx = createContext<AuthCtx | null>(null);

const SESSION_KEY = "compass_session_v1";

function loadSession(): AuthUser | null {
  const v = readJson(SESSION_KEY);
  if (!isRecord(v) || !isStr(v.id) || !isStr(v.email)) return null;
  return { id: v.id, email: v.email, plan: v.plan === "paid" ? "paid" : "free" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadSession());
  const [loading] = useState(false);

  async function signIn() {
    // Stub — real Google OAuth will be wired here when Supabase is connected (#15)
    throw new Error("OAuth not yet configured");
  }

  function signOut() {
    removeKey(SESSION_KEY);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
