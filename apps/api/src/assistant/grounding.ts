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
