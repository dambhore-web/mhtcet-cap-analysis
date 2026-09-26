// Parse the cached institute list page into data/processed/<year>/institutes.json.
// Usage: npm run parse:institutes -- [year]
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeJson } from "../io.ts";
import { readManifest } from "../manifest.ts";
import { processedDir, rawDir } from "../paths.ts";
import { parseInstituteList } from "../parse/instituteList.ts";

const year = Number(process.argv[2] ?? 2026);
const manifest = await readManifest(year);
const html = await readFile(join(rawDir(year), manifest.instituteList.file), "utf8");
const rows = parseInstituteList(html);
await writeJson(join(processedDir(year), "institutes.json"), rows);
const allotCodes = new Set(manifest.allotmentPdfs.map((a) => a.collegeCode));
const missing = [...allotCodes].filter((c) => !rows.some((r) => r.code === c));
console.log(`[PARSE] institutes: ${rows.length} rows; allotment-list colleges missing from institute list: ${missing.length}`);
