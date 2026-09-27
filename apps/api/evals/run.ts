/**
 * Assistant eval runner (docs/05-ai/evaluation.md, issue #20).
 *
 *   npm run eval                      # real model (GROQ_API_KEY) over staging data (DATABASE_URL_STAGING)
 *   npm run eval -- --data=demo       # real model over the invented demo dataset
 *   npm run eval -- --client=demo     # deterministic stand-in model: checks the harness, never gates
 *   npm run eval -- --only=EV-001,EV-045
 *
 * Calls the same runAssistant loop the API uses, so it can see which tools were called and which
 * rows came back. Writes apps/api/evals/results/<timestamp>.json and exits 1 when a threshold is
 * missed (real model only).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAssistant, UNGROUNDED_FALLBACK, type ChatClient } from "../src/assistant/run.ts";
import { groqClient } from "../src/routes/assistant.ts";
import type { AppCache } from "../src/startup.ts";
import { demoCache } from "../src/demo/demoCache.ts";
import { demoAssistant } from "../src/demo/demoAssistant.ts";
import { parseCases, pct, scoreCase, summarise, THRESHOLDS, type CaseResult, type CaseRun } from "./score.ts";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

async function loadData(): Promise<{ cache: AppCache; label: string; close: () => Promise<void> }> {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_STAGING;
  if (arg("data") === "demo" || !url) return { cache: demoCache(), label: "demo dataset", close: async () => {} };
  const { createPool } = await import("../src/db.ts");
  const { loadCache } = await import("../src/startup.ts");
  const pool = createPool();
  return { cache: await loadCache(pool, 2026), label: "database (2026)", close: () => pool.end() };
}

function pickClient(): { client: ChatClient; label: string; gates: boolean } {
  const key = process.env.GROQ_API_KEY;
  if (arg("client") === "demo" || !key) return { client: demoAssistant, label: "demo stand-in (report only)", gates: false };
  return { client: groqClient(key), label: `groq ${process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"}`, gates: true };
}

/** Wraps a client to record the tools the model asked for. */
function recording(client: ChatClient, calls: string[]): ChatClient {
  return {
    async complete(args) {
      const res = await client.complete(args);
      for (const t of res.toolCalls) calls.push(t.function.name);
      return res;
    },
  };
}

async function main() {
  const only = arg("only")?.split(",");
  const cases = parseCases(readFileSync(join(here, "assistant.v1.jsonl"), "utf8")).filter((c) => !only || only.includes(c.id));
  const { client, label: clientLabel, gates } = pickClient();
  const data = await loadData();
  // Groq's free tier allows ~30 requests a minute and a case makes 2–4 calls
  const pauseMs = Number(arg("pause-ms") ?? (gates ? 4000 : 0));

  console.log(`Assistant eval · ${cases.length} cases · model: ${clientLabel} · data: ${data.label}\n`);
  const results: CaseResult[] = [];
  for (const [i, c] of cases.entries()) {
    const calls: string[] = [];
    const start = Date.now();
    let run: CaseRun;
    try {
      const out = await runAssistant({ client: recording(client, calls), cache: data.cache, profile: c.profile ?? {}, history: [{ role: "user", content: c.question }] });
      run = { ...out, toolCalls: calls, latencyMs: Date.now() - start };
    } catch (e) {
      run = { text: `ERROR: ${e instanceof Error ? e.message : String(e)}`, sources: [], grounded: false, toolCalls: calls, latencyMs: Date.now() - start };
    }
    const r = scoreCase(c, run, data.cache, UNGROUNDED_FALLBACK);
    results.push(r);
    const mark = r.status === "pass" ? "✓" : r.status === "skipped" ? "–" : "✗";
    console.log(`${String(i + 1).padStart(2)}/${cases.length} ${mark} ${c.id} ${c.group.padEnd(12)} ${String(r.latencyMs).padStart(5)} ms  ${r.failures.map((f) => `[${f.metric}] ${f.reason}`).join("; ")}`);
    if (pauseMs && i < cases.length - 1) await new Promise((res) => setTimeout(res, pauseMs));
  }
  await data.close();

  const s = summarise(cases, results);
  console.log(`
Tool accuracy   ${pct(s.toolAccuracy)}  (threshold ${pct(THRESHOLDS.toolAccuracy)})
Factual         ${pct(s.factual)}  (threshold ${pct(THRESHOLDS.factual)})
Adversarial     ${pct(s.adversarial)}  (threshold 100%)
Grounding       ${pct(s.grounding)}  (threshold 100%)
Safe fallback   ${s.fellBack} answers
Latency         p50 ${s.latencyP50Ms} ms · p95 ${s.latencyP95Ms} ms
Skipped         ${s.skipped} (expected row not in this data)`);

  const outDir = join(here, "results");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ model: clientLabel, data: data.label, summary: s, results }, null, 2));
  console.log(`\nResults: ${file}`);

  if (!gates) {
    console.log("\nDemo stand-in model: results are a harness check only and do not gate.");
    return;
  }
  if (!s.passed) {
    console.error(`\nEval failed: ${s.misses.join("; ")}`);
    process.exit(1);
  }
  console.log("\nEval passed.");
}

main().catch((e) => {
  console.error("Eval runner crashed:", e);
  process.exit(1);
});
