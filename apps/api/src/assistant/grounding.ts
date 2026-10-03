import type { SourceRow } from "./tools.ts";

/**
 * Code-level grounding check (docs/05-ai/guardrails.md): every number of 3+ digits in an answer
 * must appear in a tool result from this turn, the student's profile or their own messages.
 * Years are allowed. Small numbers (round counts, option positions) are not checked.
 */
export function numbersIn(text: string): number[] {
  // grouped numbers (1,781 · 12,34,567) or plain runs of 3+ digits; a trailing comma is punctuation
  return [...text.matchAll(/(?<![\w.]|\d,)\d{1,3}(?:,\d{2,3})+(?!\d)|(?<![\w.]|\d,)\d{3,}(?!\d|,\d)/g)].map((m) => Number(m[0].replace(/,/g, "")));
}

export function allowedNumbers(sources: SourceRow[], extra: (number | null | undefined)[], userTexts: string[]): Set<number> {
  const s = new Set<number>();
  for (const r of sources) {
    for (const v of Object.values(r)) if (typeof v === "number") s.add(v);
    for (const n of numbersIn(r.label)) s.add(n);
  }
  for (const n of extra) if (typeof n === "number") s.add(n);
  for (const t of userTexts) for (const n of numbersIn(t)) s.add(n);
  return s;
}

export function ungroundedNumbers(answer: string, allowed: Set<number>): number[] {
  return numbersIn(answer).filter((n) => !(n >= 2000 && n <= 2100) && !allowed.has(n));
}

/**
 * Citation check: a closing merit in the answer must sit in the same sentence (or table line) as
 * a citation to a row with exactly that closing merit. This catches a real number quoted from the
 * wrong row (say Round II's value attributed to Round I), which the plain grounding check can't
 * see. Numbers the student wrote or has in their profile are exempt, as are codes and other
 * numbers that aren't a closing merit.
 */
export function miscitedNumbers(answer: string, sources: SourceRow[], exempt: (number | null | undefined)[], userTexts: string[]): number[] {
  const closings = new Set(sources.map((r) => r.closingMerit).filter((v): v is number => typeof v === "number"));
  const free = new Set<number>();
  for (const n of exempt) if (typeof n === "number") free.add(n);
  for (const t of userTexts) for (const n of numbersIn(t)) free.add(n);
  const byId = new Map(sources.filter((r) => r.id).map((r) => [r.id!, r]));

  const bad: number[] = [];
  // Sentences end at . ! ? or a line break; a number's own thousands separators are not breaks
  for (const part of answer.split(/(?<=[.!?])\s+|\n+/)) {
    const cited = [...part.matchAll(/\[S(\d+)\]/g)].map((m) => byId.get(`S${m[1]}`)).filter((r): r is SourceRow => !!r);
    for (const n of numbersIn(part)) {
      if (!closings.has(n) || free.has(n)) continue;
      if (!cited.some((r) => r.closingMerit === n)) bad.push(n);
    }
  }
  return bad;
}
