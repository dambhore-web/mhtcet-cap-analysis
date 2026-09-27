import { createContext, useContext, useState, type ReactNode } from "react";

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
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadSession());
  const [loading] = useState(false);

  async function signIn() {
    // Stub — real Google OAuth will be wired here when Supabase is connected (#15)
    throw new Error("OAuth not yet configured");
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
