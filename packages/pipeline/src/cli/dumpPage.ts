// Layout study helper: print the words of PDF pages as lines with x positions.
// Usage: tsx src/cli/dumpPage.ts <pdf> <page|all> [--raw]
// Personal data is masked: application IDs (EN + 8 digits) and the words between an ID and the
// next ~230 pt (the name column) are replaced by "#". Still, never commit the output.
import { readPages, type Word } from "../pdf.ts";

const [path, pageArg, flag] = process.argv.slice(2);
if (!path || !pageArg) throw new Error("usage: dumpPage <pdf> <page|all> [--raw]");
const all = pageArg === "all";
const target = all ? 1 : Number(pageArg);

function mask(ws: Word[]): Word[] {
  const ids = ws.filter((w) => /EN\d{8}/.test(w.text));
  return ws.map((w) =>
    ids.some((i) => Math.abs(i.y0 - w.y0) < 14 && w.x0 >= i.x0 - 1 && w.x0 < i.x0 + 230) ? { ...w, text: "#" } : w,
  );
}

let p = 0;
for await (const words of readPages(path)) {
  if (++p < target) continue;
  const lines = new Map<number, Word[]>();
  for (const w of words) {
    const k = Math.round(w.y0 / 2);
    (lines.get(k) ?? lines.set(k, []).get(k)!).push(w);
  }
  // Mask per visual row: IDs and names can sit on adjacent 2-pt buckets.
  const masked = mask(words);
  const byRef = new Map(words.map((w, i) => [w, masked[i]]));
  for (const [k, ws] of [...lines.entries()].sort((a, b) => a[0] - b[0])) {
    ws.sort((a, b) => a.x0 - b.x0);
    const out = ws.map((w) => byRef.get(w)!);
    console.log(
      `y${(k * 2).toString().padStart(4)} ` +
        (flag === "--raw" ? out.map((w) => `${w.x0.toFixed(0)}:${w.text}`).join(" ") : out.map((w) => w.text).join(" ")),
    );
  }
  if (!all) break;
  console.log(`=== END PAGE ${p}`);
}
