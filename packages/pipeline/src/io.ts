import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

/** Write rows as NDJSON (one JSON object per line). */
export async function writeNdjson(path: string, rows: Iterable<unknown>): Promise<number> {
  await mkdir(dirname(path), { recursive: true });
  const out = createWriteStream(path, "utf8");
  let n = 0;
  for (const r of rows) {
    if (!out.write(`${JSON.stringify(r)}\n`)) await new Promise((res) => out.once("drain", res));
    n++;
  }
  await new Promise<void>((res, rej) => out.end((err?: Error | null) => (err ? rej(err) : res())));
  return n;
}

export async function readNdjson<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  const rl = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) if (line.trim()) rows.push(JSON.parse(line) as T);
  return rows;
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

/** Minimal CSV reader for the local parity baselines (no quoted fields with commas expected). */
export async function readCsv(path: string): Promise<Record<string, string>[]> {
  const text = await readFile(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const head = lines[0].split(",");
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
  });
}
