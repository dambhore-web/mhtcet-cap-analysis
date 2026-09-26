import type { Word } from "../src/layout.ts";

/** Build a synthetic word (5 pt per character) for layout fixtures. */
export const w = (x0: number, y0: number, text: string, charW = 5): Word => ({ x0, y0, x1: x0 + text.length * charW, text });

/** Several words on one line, given as [x, text] pairs. */
export const line = (y: number, ...items: [number, string][]): Word[] => items.map(([x, t]) => w(x, y, t));
