import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadProfile, saveProfile, clearProfile, type Profile, DEFAULT_PROFILE } from "./profile";
import { SYNC_APPLIED_EVENT } from "./storage";

interface ProfileCtx {
  profile: Profile;
  setProfile: (p: Profile) => void;
  resetProfile: () => void;
  hasProfile: boolean;
}

const Ctx = createContext<ProfileCtx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>(() => loadProfile() ?? DEFAULT_PROFILE);
  const [hasProfile, setHasProfile] = useState(() => loadProfile() !== null);

  // the account's copy arrived (#15): show it
  useEffect(() => {
    const reload = () => {
      const p = loadProfile();
      setProfileState(p ?? DEFAULT_PROFILE);
      setHasProfile(p !== null);
    };
    window.addEventListener(SYNC_APPLIED_EVENT, reload);
    // re-read once: a change between the first render and this subscription would otherwise be missed
    reload();
    return () => window.removeEventListener(SYNC_APPLIED_EVENT, reload);
  }, []);

  function setProfile(p: Profile) {
    saveProfile(p);
    setProfileState(p);
    setHasProfile(true);
  }

  function resetProfile() {
    clearProfile();
    setProfileState(DEFAULT_PROFILE);
    setHasProfile(false);
  }

  return <Ctx.Provider value={{ profile, setProfile, resetProfile, hasProfile }}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfile must be inside ProfileProvider");
  return ctx;
}
