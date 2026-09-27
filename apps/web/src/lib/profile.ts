import type { Category } from "./api";

export interface Profile {
  meritNumber: number | null;
  category: Category | null;
  gender: "M" | "F";
  subjectGroup: "PCM" | "PCB";
  homeUniversity: string;
  ews: boolean;
  tfws: boolean;
  defence: boolean;
  pwd: boolean;
  orphan: boolean;
}

const KEY = "compass_profile_v1";

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearProfile() {
  localStorage.removeItem(KEY);
}

export const DEFAULT_PROFILE: Profile = {
  meritNumber: null,
  category: null,
  gender: "M",
  subjectGroup: "PCM",
  homeUniversity: "",
  ews: false,
  tfws: false,
  defence: false,
  pwd: false,
  orphan: false,
};
