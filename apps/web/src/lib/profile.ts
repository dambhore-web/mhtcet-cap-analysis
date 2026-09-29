import type { Category } from "./api";
import { readJson, writeJson, removeKey, isRecord, isNum, isStr, isBool } from "./storage";

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
  /** Minority community as the CAP lists spell it (e.g. "Muslim", "Gujarathi"); null if none. */
  minorityCommunity: string | null;
}

const KEY = "compass_profile_v1";

const CATEGORIES: readonly Category[] = ["OPEN", "OBC", "SEBC", "SC", "ST", "VJ", "NT1", "NT2", "NT3"];

/** Shape-check a stored profile; invalid fields fall back to the defaults. */
export function parseProfile(v: unknown): Profile | null {
  if (!isRecord(v)) return null;
  const d = DEFAULT_PROFILE;
  const flag = (x: unknown) => (isBool(x) ? x : false);
  return {
    meritNumber: isNum(v.meritNumber) && v.meritNumber > 0 ? v.meritNumber : null,
    category: CATEGORIES.includes(v.category as Category) ? (v.category as Category) : null,
    gender: v.gender === "F" ? "F" : d.gender,
    subjectGroup: v.subjectGroup === "PCB" ? "PCB" : d.subjectGroup,
    homeUniversity: isStr(v.homeUniversity) ? v.homeUniversity : d.homeUniversity,
    ews: flag(v.ews),
    tfws: flag(v.tfws),
    defence: flag(v.defence),
    pwd: flag(v.pwd),
    orphan: flag(v.orphan),
    minorityCommunity: isStr(v.minorityCommunity) && v.minorityCommunity.trim() ? v.minorityCommunity.trim() : null,
  };
}

export function loadProfile(): Profile | null {
  return parseProfile(readJson(KEY));
}

export function saveProfile(p: Profile) {
  writeJson(KEY, p);
}

export function clearProfile() {
  removeKey(KEY);
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
  minorityCommunity: null,
};
