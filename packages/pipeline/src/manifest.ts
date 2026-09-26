import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { rawDir } from "./paths.ts";
import type { Round } from "@mhtcet/core";

export type CutoffListKind = "MH" | "AI" | "Diploma";

export interface ManifestFile {
  url: string;
  /** Path relative to data/raw/<year>/ */
  file: string;
}
export interface CutoffListEntry extends ManifestFile {
  kind: CutoffListKind;
  round: Round;
  version: number | null;
}
export interface AllotmentEntry extends ManifestFile {
  collegeCode: string;
  collegeName: string;
  round: Round;
}
export interface MeritListEntry extends ManifestFile {
  /** e.g. PCMAI, PCMMH, PCBAI */
  list: string;
  stage: "Final" | "Provisional";
}
export interface Manifest {
  year: number;
  discoveredAt: string;
  pages: { home: string; instituteList: string; allotmentList: string };
  cutoffLists: CutoffListEntry[];
  meritLists: MeritListEntry[];
  seatMatrix: ManifestFile[];
  instituteList: ManifestFile;
  allotmentPdfs: AllotmentEntry[];
  /** Links to earlier years' cutoff lists found on this year's home page (not downloaded). */
  earlierYearLinks: string[];
}

export async function readManifest(year: number): Promise<Manifest> {
  return JSON.parse(await readFile(join(rawDir(year), "manifest.json"), "utf8")) as Manifest;
}
