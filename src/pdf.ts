import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api.js";

/** One whitespace-separated word with its top-left corner in PDF points (top-origin y). */
export interface Word {
  x0: number;
  y0: number;
  text: string;
}

/** Yield the words of each page in order, page by page, so large files stay out of memory. */
export async function* readPages(path: string): AsyncGenerator<Word[]> {
  const data = new Uint8Array(await readFile(path));
  const doc = await getDocument({ data, verbosity: 0, useSystemFonts: false }).promise;
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const height = page.view[3] - page.view[1];
      const content = await page.getTextContent();
      const words: Word[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const it = item as TextItem;
        if (!it.str.trim()) continue;
        const x = it.transform[4];
        const y0 = height - it.transform[5] - (it.height || Math.abs(it.transform[3]));
        const charW = it.str.length ? it.width / it.str.length : 0;
        const re = /\S+/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(it.str))) words.push({ x0: x + m.index * charW, y0, text: m[0] });
      }
      page.cleanup();
      yield words;
    }
  } finally {
    await doc.destroy();
  }
}

/** Join a page's words into lines of text (top to bottom), for regex searches like branch headers. */
export function pageText(words: Word[]): string {
  const lines = new Map<number, Word[]>();
  for (const w of words) {
    const k = Math.round(w.y0 / 2);
    (lines.get(k) ?? lines.set(k, []).get(k)!).push(w);
  }
  return [...lines.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, ws]) => ws.sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(" "))
    .join("\n");
}
