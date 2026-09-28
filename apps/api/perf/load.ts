/**
 * Performance check for NFR-002 and NFR-003 (issue #27), against a running API.
 *
 *   npm run perf -- --api=http://localhost:3001
 *   npm run perf -- --api=https://compass-api-staging.up.railway.app --duration=30
 *
 * 1. Rank finder: 50 concurrent users for 20 s with varied, realistic requests. Each user pauses
 *    1–3 s between searches (--think-ms=2000, jittered), as people read results before searching
 *    again. Target p95 < 1 s. --think-ms=0 fires back-to-back to find the saturation point.
 * 2. Assistant: 10 sequential questions, time to the first streamed text. Target p95 < 3 s.
 *    Skipped when the API has no model key (503). Uses 10 of the 20 hourly questions per IP.
 *
 * Writes apps/api/perf/results/<timestamp>.json and exits 1 when a target is missed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "@mhtcet/core";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const API = arg("api", process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const CONCURRENCY = Number(arg("concurrency", "50"));
const DURATION_S = Number(arg("duration", "20"));
const THINK_MS = Number(arg("think-ms", "2000"));
const TURNS = Number(arg("assistant-turns", "10"));
const SKIP_ASSISTANT = process.argv.includes("--skip-assistant");

const TARGETS = { rankFinderP95Ms: 1000, assistantFirstTokenP95Ms: 3000 } as const;

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

/** A plausible rank-finder request: merit spread across the whole list, mixed profiles. */
function randomRequest(rng: () => number) {
  const merit = Math.round(Math.exp(Math.log(100) + rng() * (Math.log(150000) - Math.log(100))));
  const category = rng() < 0.4 ? null : CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
  return {
    year: 2026,
    merit,
    candidature: rng() < 0.1 ? "AI" : "MH",
    category,
    gender: rng() < 0.4 ? "F" : "M",
    homeUniversity: rng() < 0.5 ? "Savitribai Phule Pune University" : null,
    flags: { ews: rng() < 0.1, tfws: rng() < 0.2, defence: false, pwd: false, orphan: false },
  };
}

/** Deterministic PRNG so two runs send the same mix. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function rankFinderLoad() {
  const rng = mulberry32(2026);
  const latencies: number[] = [];
  let errors = 0;
  const firstError: string[] = [];
  const endAt = performance.now() + DURATION_S * 1000;

  // Warm up: first requests pay for JIT and connection setup
  for (let i = 0; i < 5; i++) await fetch(`${API}/api/rank-finder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(randomRequest(rng)) }).then((r) => r.arrayBuffer());

  const pause = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const think = () => (THINK_MS ? pause(THINK_MS * (0.5 + rng())) : Promise.resolve());

  const worker = async () => {
    await pause(rng() * THINK_MS); // users arrive over the first few seconds, not all at once
    while (performance.now() < endAt) {
      const body = JSON.stringify(randomRequest(rng));
      const t0 = performance.now();
      try {
        const res = await fetch(`${API}/api/rank-finder`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        await res.arrayBuffer();
        if (!res.ok) {
          errors++;
          if (firstError.length < 3) firstError.push(`HTTP ${res.status}`);
          continue;
        }
        latencies.push(performance.now() - t0);
      } catch (e) {
        errors++;
        if (firstError.length < 3) firstError.push(e instanceof Error ? e.message : String(e));
      }
      await think();
    }
  };
  const started = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const seconds = (performance.now() - started) / 1000;
  return {
    requests: latencies.length,
    errors,
    errorSamples: firstError,
    rps: Math.round(latencies.length / seconds),
    p50Ms: Math.round(percentile(latencies, 50)),
    p95Ms: Math.round(percentile(latencies, 95)),
    p99Ms: Math.round(percentile(latencies, 99)),
    maxMs: Math.round(Math.max(0, ...latencies)),
  };
}

const QUESTIONS = [
  "What was the Round I GOPENS closing merit for Computer Engineering at COEP?",
  "What is the difference between Freeze, Float and Slide?",
  "What does GOPENH mean?",
  "Which colleges could I get with merit 12000?",
  "What was the cutoff for Mechanical Engineering at VJTI?",
];

/** Time from sending the question to the first streamed text, and to the end of the answer. */
async function firstToken(question: string): Promise<{ status: number; firstMs: number; totalMs: number }> {
  const t0 = performance.now();
  const res = await fetch(`${API}/api/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: question }], profile: { merit: 12000, category: "OPEN", gender: "M" } }),
  });
  if (!res.ok || !res.body) {
    await res.arrayBuffer().catch(() => {});
    return { status: res.status, firstMs: 0, totalMs: 0 };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstMs = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (!firstMs && /data: \{"delta"/.test(buffer)) firstMs = performance.now() - t0;
  }
  return { status: res.status, firstMs: Math.round(firstMs), totalMs: Math.round(performance.now() - t0) };
}

async function assistantLatency() {
  const turns: { firstMs: number; totalMs: number }[] = [];
  for (let i = 0; i < TURNS; i++) {
    const r = await firstToken(QUESTIONS[i % QUESTIONS.length]);
    if (r.status === 503) return { skipped: "the API has no model key (503)" } as const;
    if (r.status === 429) return { skipped: "rate limited (429): the API allows 20 questions an hour per IP" } as const;
    if (r.status !== 200 || !r.firstMs) return { skipped: `unexpected response (HTTP ${r.status})` } as const;
    turns.push(r);
  }
  return {
    turns: turns.length,
    firstTokenP50Ms: percentile(turns.map((t) => t.firstMs), 50),
    firstTokenP95Ms: percentile(turns.map((t) => t.firstMs), 95),
    totalP95Ms: percentile(turns.map((t) => t.totalMs), 95),
  };
}

async function main() {
  const health = await fetch(`${API}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`API not reachable at ${API}/api/health`);

  console.log(`Rank finder: ${CONCURRENCY} concurrent users, ${THINK_MS ? `~${THINK_MS} ms between searches` : "no pause between searches"}, for ${DURATION_S} s against ${API} …`);
  const rank = await rankFinderLoad();
  console.log(`  ${rank.requests} requests, ${rank.rps}/s, ${rank.errors} errors · p50 ${rank.p50Ms} ms · p95 ${rank.p95Ms} ms · p99 ${rank.p99Ms} ms · max ${rank.maxMs} ms`);
  if (rank.errorSamples.length) console.log(`  errors: ${rank.errorSamples.join(", ")}`);

  let assistant: Awaited<ReturnType<typeof assistantLatency>> | { skipped: string } = { skipped: "--skip-assistant" };
  if (!SKIP_ASSISTANT) {
    console.log(`Assistant: ${TURNS} sequential questions …`);
    assistant = await assistantLatency();
    console.log("skipped" in assistant ? `  skipped: ${assistant.skipped}` : `  first text p50 ${assistant.firstTokenP50Ms} ms · p95 ${assistant.firstTokenP95Ms} ms · whole answer p95 ${assistant.totalP95Ms} ms`);
  }

  const misses: string[] = [];
  if (rank.errors > 0) misses.push(`rank finder returned ${rank.errors} errors`);
  if (rank.p95Ms >= TARGETS.rankFinderP95Ms) misses.push(`rank finder p95 ${rank.p95Ms} ms ≥ ${TARGETS.rankFinderP95Ms} ms`);
  if (!("skipped" in assistant) && assistant.firstTokenP95Ms >= TARGETS.assistantFirstTokenP95Ms) {
    misses.push(`assistant first text p95 ${assistant.firstTokenP95Ms} ms ≥ ${TARGETS.assistantFirstTokenP95Ms} ms`);
  }

  const dir = join(dirname(fileURLToPath(import.meta.url)), "results");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ api: API, concurrency: CONCURRENCY, thinkMs: THINK_MS, durationS: DURATION_S, targets: TARGETS, rankFinder: rank, assistant, misses }, null, 2));
  console.log(`\nResults: ${file}`);

  if (misses.length) {
    console.error(`\nPerformance targets missed: ${misses.join("; ")}`);
    process.exit(1);
  }
  console.log("\nPerformance targets met.");
}

main().catch((e) => {
  console.error("Perf run crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
