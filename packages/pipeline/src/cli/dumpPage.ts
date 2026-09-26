// Layout study helper: print the words of PDF pages as lines with x positions.
// Usage: tsx src/cli/dumpPage.ts <pdf> <page|all> [--raw]
// Personal data is always masked (maskPersonalData): application IDs and the name column become
// "#". Still, never save the output of allotment or merit PDFs into the repo.
import { clusterLines, maskPersonalData } from "../layout.ts";
import { readPages } from "../pdf.ts";

const [path, pageArg, flag] = process.argv.slice(2);
if (!path || !pageArg) throw new Error("usage: dumpPage <pdf> <page|all> [--raw]");
const all = pageArg === "all";
const target = all ? 1 : Number(pageArg);
let p = 0;
for await (const words of readPages(path)) {
  if (++p < target) continue;
  for (const line of clusterLines(maskPersonalData(words), 1)) {
    const text = flag === "--raw" ? line.words.map((w) => `${w.x0.toFixed(0)}:${w.text}`).join(" ") : line.text;
    console.log(`y${line.y.toFixed(0).padStart(4)} ${text}`);
  }
  if (!all) break;
  console.log(`=== END PAGE ${p}`);
}
