import { useEffect, useState } from "react";
import type { Allotment } from "./allotment";
import { isRecord, isStr, readJson, writeJson } from "./storage";

/**
 * Which My CAP plan steps the student has done in this browser (#135), so the next-step card can
 * point at the one after. Only dates and the allotted seat a decision was about; no personal data.
 */
export interface Progress {
  simulatedAt: string | null;
  exportedAt: string | null;
  /** The decision after an allotment holds only for that seat (choice code + round). */
  decided: { at: string; choiceCode: string; round: string } | null;
}

const KEY = "compass_progress_v1";
const EVENT = "compass-progress-change";
export const EMPTY_PROGRESS: Progress = { simulatedAt: null, exportedAt: null, decided: null };

export function loadProgress(): Progress {
  const v = readJson(KEY);
  if (!isRecord(v)) return EMPTY_PROGRESS;
  const d = v.decided;
  return {
    simulatedAt: isStr(v.simulatedAt) ? v.simulatedAt : null,
    exportedAt: isStr(v.exportedAt) ? v.exportedAt : null,
    decided: isRecord(d) && isStr(d.at) && isStr(d.choiceCode) && isStr(d.round) ? { at: d.at, choiceCode: d.choiceCode, round: d.round } : null,
  };
}

function save(p: Progress) {
  writeJson(KEY, p);
  window.dispatchEvent(new Event(EVENT));
}

export function markSimulated() {
  save({ ...loadProgress(), simulatedAt: new Date().toISOString() });
}

export function markExported() {
  save({ ...loadProgress(), exportedAt: new Date().toISOString() });
}

/** Record (or with null, undo) that the student has acted on this allotment. */
export function markDecided(allotment: Allotment | null) {
  save({ ...loadProgress(), decided: allotment ? { at: new Date().toISOString(), choiceCode: allotment.choiceCode, round: allotment.round } : null });
}

/** Has the student decided on exactly this allotment (not an earlier round's)? */
export function decidedOn(p: Progress, allotment: Allotment | null): boolean {
  return !!allotment && !!p.decided && p.decided.choiceCode === allotment.choiceCode && p.decided.round === allotment.round;
}

export function useProgress(): Progress {
  const [p, setP] = useState(loadProgress);
  useEffect(() => {
    const f = () => setP(loadProgress());
    window.addEventListener(EVENT, f);
    window.addEventListener("storage", f);
    return () => {
      window.removeEventListener(EVENT, f);
      window.removeEventListener("storage", f);
    };
  }, []);
  return p;
}
