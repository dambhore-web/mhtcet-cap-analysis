/** Pure layout helpers shared by the parsers (no I/O, unit-testable with synthetic words). */

/** One whitespace-separated word: left/right x and top y in PDF points (top-origin). */
export interface Word {
  x0: number;
  /** Right edge; estimated from the text item's average character width. */
  x1: number;
  y0: number;
  text: string;
}

export interface Line {
  /** y of the first word of the line (smallest y0). */
  y: number;
  words: Word[];
  text: string;
}

/**
 * Group words into visual lines. Words whose y0 is within `tol` points of the first word of the
 * current line join it (handles labels printed 1–2 pt higher or lower than their row).
 */
export function clusterLines(words: Word[], tol = 3): Line[] {
  const sorted = [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines: Line[] = [];
  let cur: Word[] = [];
  let curY = Number.NEGATIVE_INFINITY;
  const flush = (): void => {
    if (!cur.length) return;
    cur.sort((a, b) => a.x0 - b.x0);
    lines.push({ y: curY, words: cur, text: cur.map((w) => w.text).join(" ") });
    cur = [];
  };
  for (const w of sorted) {
    if (w.y0 - curY > tol) {
      flush();
      curY = w.y0;
    }
    cur.push(w);
  }
  flush();
  return lines;
}

/** Join a page's words into lines of text (top to bottom), for regex searches. */
export function pageText(words: Word[]): string {
  return clusterLines(words).map((l) => l.text).join("\n");
}

export const median = (xs: number[]): number => {
  if (!xs.length) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Application ID pattern printed in allotment and merit lists (personal data; never output). */
export const APPLICATION_ID = /^EN\d{8}$/;
