import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api.js";
import type { Word } from "./layout.ts";

export type { Word } from "./layout.ts";

/**
 * Yield the words of each page in order, page by page, so large files stay out of memory.
 * Pages are released with page.cleanup() after their text is read.
 */
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
        while ((m = re.exec(it.str))) {
          words.push({ x0: x + m.index * charW, x1: x + (m.index + m[0].length) * charW, y0, text: m[0] });
        }
      }
      page.cleanup();
      yield words;
    }
  } finally {
    await doc.destroy();
  }
}

/** Number of pages without reading their text. */
export async function pageCount(path: string): Promise<number> {
  const data = new Uint8Array(await readFile(path));
  const doc = await getDocument({ data, verbosity: 0, useSystemFonts: false }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}
