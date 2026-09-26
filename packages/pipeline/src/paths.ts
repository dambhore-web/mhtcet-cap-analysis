import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

/** Repository root (two levels above packages/pipeline/src). */
export const REPO_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
export const DATA_DIR = join(REPO_ROOT, "data");
export const REPORTS_DIR = join(REPO_ROOT, "reports");

export const rawDir = (year: number): string => join(DATA_DIR, "raw", String(year));
export const processedDir = (year: number): string => join(DATA_DIR, "processed", String(year));
