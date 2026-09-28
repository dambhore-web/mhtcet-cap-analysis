import type { SourceRow } from "./tools.ts";

/** A closing merit the way the official lists and Indian readers write it: 1,781 · 12,345 · 1,23,456. */
export function formatMerit(n: number): string {
  return n.toLocaleString("en-IN");
}

/**
 * The model writes {{S3}} where a closing merit goes; code puts in that row's exact value and its
 * citation, so no cutoff number is ever typed by the model. A "[S3]" the model also wrote right
 * after the placeholder is folded into one citation.
 *
 * Returns the rendered text and the placeholders that point at no row with a closing merit (the
 * caller treats those as a failed answer).
 */
export function renderPlaceholders(text: string, sources: SourceRow[]): { text: string; unknown: string[] } {
  const byId = new Map(sources.filter((r) => r.id).map((r) => [r.id!, r]));
  const unknown: string[] = [];
  const rendered = text.replace(/\{\{\s*(S\d+)\s*\}\}(\s*\[\1\])?/g, (whole, id: string) => {
    const row = byId.get(id);
    if (!row || typeof row.closingMerit !== "number") {
      unknown.push(id);
      return whole;
    }
    return `${formatMerit(row.closingMerit)} [${id}]`;
  });
  return { text: rendered, unknown };
}
