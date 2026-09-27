import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { loadProfile, saveProfile, type Profile, DEFAULT_PROFILE } from "./profile";

interface ProfileCtx {
  profile: Profile;
  setProfile: (p: Profile) => void;
  hasProfile: boolean;
}

const Ctx = createContext<ProfileCtx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>(DEFAULT_PROFILE);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const saved = loadProfile();
    if (saved) {
      setProfileState(saved);
      setHasProfile(true);
    }
  }, []);

  function setProfile(p: Profile) {
    saveProfile(p);
    setProfileState(p);
    setHasProfile(true);
  }

  return <Ctx.Provider value={{ profile, setProfile, hasProfile }}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfile must be inside ProfileProvider");
  return ctx;
}
