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
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAssistant, UNGROUNDED_FALLBACK, type ChatClient } from "../src/assistant/run.ts";
import Groq from "groq-sdk";
import { groqClient, MODEL } from "../src/routes/assistant.ts";
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
  return { client: groqClient(key), label: `groq ${MODEL}`, gates: true };
}

/** Stops early with the models Groq actually serves when the configured one isn't among them. */
async function checkModel(): Promise<void> {
  const key = process.env.GROQ_API_KEY;
  if (!key || arg("client") === "demo") return;
  const { data } = await new Groq({ apiKey: key }).models.list();
  const ids = data.map((m) => m.id).sort();
  if (!ids.includes(MODEL)) {
    console.error(`Groq does not serve the model "${MODEL}". Set GROQ_MODEL to one of:\n  ${ids.join("\n  ")}`);
    process.exit(1);
  }
}

/** Consecutive errors after which the run stops: the problem is the setup, not the answers. */
const MAX_ERRORS_IN_A_ROW = 3;

/**
 * Free-tier Groq allows a few thousand tokens a minute per model, and one case can use most of
 * that. On a 429, wait as long as Groq asks (plus a margin) and try again, up to a few minutes.
 */
/** Time spent waiting on rate limits in the current case, taken out of its latency. */
let waitedMs = 0;

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/^429\b|rate_limit_exceeded/.test(msg) || attempt >= 8) throw e;
      const m = /try again in ([\d.]+)(ms|s)/.exec(msg);
      const asked = m ? Number(m[1]) / (m[2] === "ms" ? 1000 : 1) : 10;
      const waitS = Math.min(60, Math.max(5, asked * 1.5));
      console.log(`      rate limited; waiting ${waitS.toFixed(0)} s`);
      await new Promise((res) => setTimeout(res, waitS * 1000));
      waitedMs += waitS * 1000;
    }
  }
}

/** Wraps a client to record the tools the model asked for, retrying rate limits. */
function recording(client: ChatClient, calls: string[]): ChatClient {
  return {
    async complete(args) {
      const res = await withRateLimitRetry(() => client.complete(args));
      for (const t of res.toolCalls) calls.push(t.function.name);
      return res;
    },
  };
}

async function main() {
  const only = arg("only")?.split(",");
  await checkModel();
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
    waitedMs = 0;
    let run: CaseRun;
    try {
      const out = await runAssistant({ client: recording(client, calls), cache: data.cache, profile: c.profile ?? {}, history: [{ role: "user", content: c.question }] });
      run = { ...out, toolCalls: calls, latencyMs: Date.now() - start - waitedMs };
    } catch (e) {
      run = { text: "", sources: [], grounded: false, toolCalls: calls, latencyMs: Date.now() - start - waitedMs, error: e instanceof Error ? e.message : String(e) };
    }
    const r = scoreCase(c, run, data.cache, UNGROUNDED_FALLBACK);
    results.push(r);
    const mark = r.status === "pass" ? "✓" : r.status === "skipped" ? "–" : "✗";
    console.log(`${String(i + 1).padStart(2)}/${cases.length} ${mark} ${c.id} ${c.group.padEnd(12)} ${String(r.latencyMs).padStart(5)} ms  ${r.failures.map((f) => `[${f.metric}] ${f.reason}`).join("; ")}`);
    // Show what a failed answer said, so a model mistake can be told from a bad test case
    if (r.status === "fail" && !run.error) console.log(`         tools: ${calls.join(", ") || "none"} · answer: ${run.text.replace(/\s+/g, " ").slice(0, 300)}`);
    const recent = results.slice(-MAX_ERRORS_IN_A_ROW);
    if (recent.length === MAX_ERRORS_IN_A_ROW && recent.every((x) => x.failures.some((f) => f.metric === "error"))) {
      console.error(`\nStopping: ${MAX_ERRORS_IN_A_ROW} errors in a row. Last error: ${recent.at(-1)!.failures[0].reason}`);
      process.exit(1);
    }
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

  // In CI, a table on the job page makes models easy to compare side by side
  if (process.env.GITHUB_STEP_SUMMARY) {
    const failed = results.filter((r) => r.status === "fail").map((r) => `${r.id} (${r.failures.map((f) => f.reason).join("; ")})`);
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Assistant eval: ${clientLabel}\n\n| Tool accuracy | Factual | Adversarial | Grounding | Fallbacks | p50 | p95 | Skipped |\n|---|---|---|---|---|---|---|---|\n` +
        `| ${pct(s.toolAccuracy)} | ${pct(s.factual)} | ${pct(s.adversarial)} | ${pct(s.grounding)} | ${s.fellBack} | ${s.latencyP50Ms} ms | ${s.latencyP95Ms} ms | ${s.skipped} |\n\n` +
        (failed.length ? `<details><summary>${failed.length} failed</summary>\n\n${failed.map((f) => `- ${f}`).join("\n")}\n</details>\n` : "All scored cases passed.\n"),
    );
  }

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
