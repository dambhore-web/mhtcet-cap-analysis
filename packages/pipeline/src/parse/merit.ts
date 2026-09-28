import type { MeritExam, MeritRow } from "@mhtcet/core";
import { APPLICATION_ID, type Word } from "../layout.ts";

/**
 * Parser for the merit lists: All India (`FE<year>_PCMAI_MeritList_Final.pdf`) and Maharashtra State
 * (`FE<year>_PCMMH_MeritList_Final.pdf`); the column positions differ, see MeritLayout.
 * Coordinate-based: a row is a merit number at x < 82 with an application ID just right of it
 * (x 80-130, same y +-4). The merit exam (x 240-310) and percentile/marks (x 295-360) are the
 * nearest matching words in y. The ID is used only to recognise a row and is never kept; names
 * are never read. Long names wrap onto a second line, which has no merit number and is ignored.
 */

const EXAM = /^(JEE|MHT-CET-PCM|Diploma|D\.Voc\.)$/;
const SCORE = /^\d+(?:\.\d+)?$/;
const MERIT = /^\d+$/;
const BAND = 4;

/** x windows (PDF points) of the columns read from a merit list page. */
export interface MeritLayout {
  /** merit numbers start left of this */
  meritMaxX: number;
  /** application ID column (used only to recognise a row, never kept) */
  id: { lo: number; hi: number };
  exam: { lo: number; hi: number };
  /** the candidate's merit-exam percentile / marks (first score column) */
  score: { lo: number; hi: number };
}

/** All India list: merit, ID, name, then the merit exam and its percentile. */
export const AI_MERIT_LAYOUT: MeritLayout = { meritMaxX: 82, id: { lo: 70, hi: 130 }, exam: { lo: 240, hi: 310 }, score: { lo: 295, hi: 360 } };
/**
 * State (MH) list: merit, ID, name, category, gender, reservations, type, then the merit exam and
 * its percentile. Category, gender and reservation columns are never read.
 */
export const MH_MERIT_LAYOUT: MeritLayout = { meritMaxX: 56, id: { lo: 55, hi: 95 }, exam: { lo: 495, hi: 555 }, score: { lo: 548, hi: 600 } };

export interface MeritParseIssue {
  page: number;
  kind: string;
  merit: number;
}

export function parseMeritPage(
  words: Word[], page: number, issues: MeritParseIssue[], layout: MeritLayout = AI_MERIT_LAYOUT,
): MeritRow[] {
  const ids = words.filter((w) => APPLICATION_ID.test(w.text) && w.x0 >= layout.id.lo && w.x0 < layout.id.hi);
  const rows: MeritRow[] = [];
  for (const m of words) {
    if (m.x0 >= layout.meritMaxX || !MERIT.test(m.text)) continue;
    if (!ids.some((i) => Math.abs(i.y0 - m.y0) < BAND)) continue;
    const merit = Number(m.text);
    const pick = (lo: number, hi: number, re: RegExp): Word | null => {
      let best: Word | null = null;
      for (const w of words) {
        if (w.x0 < lo || w.x0 >= hi || !re.test(w.text)) continue;
        const dy = Math.abs(w.y0 - m.y0);
        if (dy < BAND && (!best || dy < Math.abs(best.y0 - m.y0))) best = w;
      }
      return best;
    };
    const exam = pick(layout.exam.lo, layout.exam.hi, EXAM);
    const score = pick(layout.score.lo, layout.score.hi, SCORE);
    if (!exam || !score) {
      issues.push({ page, kind: !exam ? "no-exam" : "no-score", merit });
      continue;
    }
    rows.push({ merit, exam: exam.text as MeritExam, score: Number(score.text) });
  }
  return rows.sort((a, b) => a.merit - b.merit);
}

const MH_ID_WIN = { lo: 50, hi: 100 };
const MH_SCORE_WIN = { lo: 555, hi: 610 };

/**
 * Parser for the Maharashtra state (PCM) merit list (`FE<year>_PCMMH_MeritList_Final.pdf`).
 * Same row-anchor logic as parseMeritPage but with shifted column windows:
 *   - application ID at x≈59 (window [50,100)), not [70,130)
 *   - score is the overall PCM percentile at x≈561 (window [555,610))
 *   - exam is always MHT-CET-PCM (not read from the PDF)
 */
export function parseMeritPageMH(words: Word[], page: number, issues: MeritParseIssue[]): MeritRow[] {
  const ids = words.filter((w) => APPLICATION_ID.test(w.text) && w.x0 >= MH_ID_WIN.lo && w.x0 < MH_ID_WIN.hi);
  const rows: MeritRow[] = [];
  for (const m of words) {
    if (m.x0 >= 82 || !MERIT.test(m.text)) continue;
    if (!ids.some((i) => Math.abs(i.y0 - m.y0) < BAND)) continue;
    const merit = Number(m.text);
    let best: Word | null = null;
    for (const w of words) {
      if (w.x0 < MH_SCORE_WIN.lo || w.x0 >= MH_SCORE_WIN.hi || !SCORE.test(w.text)) continue;
      const dy = Math.abs(w.y0 - m.y0);
      if (dy < BAND && (!best || dy < Math.abs(best.y0 - m.y0))) best = w;
    }
    if (!best) { issues.push({ page, kind: "no-score", merit }); continue; }
    rows.push({ merit, exam: "MHT-CET-PCM", score: Number(best.text) });
  }
  return rows.sort((a, b) => a.merit - b.merit);
}

/** Checks for the parsed list: contiguity of merit numbers, JEE block, monotone scores per exam. */
export function checkMeritList(rows: readonly MeritRow[]): {
  rows: number;
  minMerit: number;
  maxMerit: number;
  duplicates: number;
  gaps: number[];
  jee: { count: number; first: number; last: number; contiguous: boolean };
  monotoneViolations: { exam: string; merit: number; score: number; previous: number }[];
} {
  const sorted = [...rows].sort((a, b) => a.merit - b.merit);
  let duplicates = 0;
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i].merit - sorted[i - 1].merit;
    if (d === 0) duplicates++;
    else if (d > 1) for (let g = sorted[i - 1].merit + 1; g < sorted[i].merit && gaps.length < 1000; g++) gaps.push(g);
  }
  const jee = sorted.filter((r) => r.exam === "JEE");
  const jeeContig = jee.every((r, i) => r.merit === (jee[0]?.merit ?? 1) + i);
  const monotoneViolations: { exam: string; merit: number; score: number; previous: number }[] = [];
  const last = new Map<string, number>();
  for (const r of sorted) {
    const prev = last.get(r.exam);
    if (prev !== undefined && r.score > prev) monotoneViolations.push({ exam: r.exam, merit: r.merit, score: r.score, previous: prev });
    last.set(r.exam, r.score);
  }
  return {
    rows: sorted.length,
    minMerit: sorted[0]?.merit ?? 0,
    maxMerit: sorted[sorted.length - 1]?.merit ?? 0,
    duplicates,
    gaps,
    jee: { count: jee.length, first: jee[0]?.merit ?? 0, last: jee[jee.length - 1]?.merit ?? 0, contiguous: jeeContig },
    monotoneViolations,
  };
}
