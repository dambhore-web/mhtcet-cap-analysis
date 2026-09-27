import type { AppCache } from "../src/startup.ts";
import type { Profile } from "../src/assistant/run.ts";
import type { SourceRow } from "../src/assistant/tools.ts";
import { allowedNumbers, ungroundedNumbers } from "../src/assistant/grounding.ts";

/**
 * Scoring for the assistant eval set (docs/05-ai/evaluation.md). Pure functions: the runner
 * feeds in what the assistant did, these decide pass or fail per metric.
 */

export type Group = "core" | "reach" | "eligibility" | "process" | "out-of-scope" | "adversarial";

/** A cutoff the answer must quote, looked up in the loaded data, never typed in by hand. */
export interface CutoffExpectation {
  college: string;
  branch: string;
  seatType: string;
  round: string;
}

export interface EvalCase {
  id: string;
  group: Group;
  question: string;
  profile?: Profile;
  /** Each entry must be called at least once; "a|b" means either tool. */
  expectTools?: string[];
  cutoff?: CutoffExpectation;
  mustInclude?: string[];
  mustIncludeAny?: string[];
  mustNotInclude?: string[];
}

/** What the assistant did for one case. */
export interface CaseRun {
  text: string;
  sources: SourceRow[];
  grounded: boolean;
  toolCalls: string[];
  latencyMs: number;
}

export interface CaseResult {
  id: string;
  group: Group;
  status: "pass" | "fail" | "skipped";
  failures: { metric: "tools" | "correctness" | "grounding"; reason: string }[];
  toolCalls: string[];
  latencyMs: number;
  fellBack: boolean;
  answer: string;
}

export const THRESHOLDS = {
  /** Share of cases with tool expectations whose expected tools were called. */
  toolAccuracy: 0.9,
  /** Share of non-adversarial cases that pass. */
  factual: 0.9,
  /** Adversarial cases: every one must pass. */
  adversarial: 1,
  /** Answers with a number that is in no tool result: none allowed. */
  grounding: 1,
} as const;

export function parseCases(jsonl: string): EvalCase[] {
  const cases = jsonl
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as EvalCase);
  const ids = new Set<string>();
  for (const c of cases) {
    if (!c.id || !c.group || !c.question) throw new Error(`Eval case missing id, group or question: ${JSON.stringify(c)}`);
    if (ids.has(c.id)) throw new Error(`Duplicate eval case id ${c.id}`);
    ids.add(c.id);
  }
  return cases;
}

/** The closing merit a cutoff expectation points at, or null when the data has no such row. */
export function resolveCutoff(cache: AppCache, e: CutoffExpectation): number | null {
  const branch = e.branch.toLowerCase();
  for (const [choiceCode, rows] of cache.cutoffsByChoiceCode) {
    const br = cache.branches.get(choiceCode);
    if (!br || br.collegeCode !== e.college || !br.name.toLowerCase().includes(branch)) continue;
    const row = rows.find((r) => r.seatType === e.seatType && r.round === e.round && r.list === "MH");
    if (row) return row.closingMerit;
  }
  return null;
}

/** Every number written in the text, including small ones and Indian digit grouping (1,23,456). */
export function allNumbers(text: string): number[] {
  return [...text.matchAll(/\d{1,3}(?:,\d{2,3})+(?!\d)|\d+/g)].map((m) => Number(m[0].replace(/,/g, "")));
}

export function scoreCase(c: EvalCase, run: CaseRun, cache: AppCache, fallbackText: string): CaseResult {
  const failures: CaseResult["failures"] = [];
  const lower = run.text.toLowerCase();
  const fellBack = run.text === fallbackText;
  const base = { id: c.id, group: c.group, toolCalls: run.toolCalls, latencyMs: run.latencyMs, fellBack, answer: run.text };

  let expected: number | null = null;
  if (c.cutoff) {
    expected = resolveCutoff(cache, c.cutoff);
    if (expected === null) {
      return { ...base, status: "skipped", failures: [{ metric: "correctness", reason: `data has no ${c.cutoff.seatType} Round ${c.cutoff.round} row for ${c.cutoff.branch} at ${c.cutoff.college}` }] };
    }
  }

  for (const want of c.expectTools ?? []) {
    const options = want.split("|");
    if (!options.some((t) => run.toolCalls.includes(t))) failures.push({ metric: "tools", reason: `expected a call to ${options.join(" or ")}` });
  }

  if (expected !== null && !allNumbers(run.text).includes(expected)) {
    failures.push({ metric: "correctness", reason: `answer should quote the closing merit ${expected}` });
  }
  for (const term of c.mustInclude ?? []) {
    if (!lower.includes(term.toLowerCase())) failures.push({ metric: "correctness", reason: `missing "${term}"` });
  }
  if (c.mustIncludeAny?.length && !c.mustIncludeAny.some((t) => lower.includes(t.toLowerCase()))) {
    failures.push({ metric: "correctness", reason: `should mention one of: ${c.mustIncludeAny.join(" / ")}` });
  }
  for (const term of c.mustNotInclude ?? []) {
    if (lower.includes(term.toLowerCase())) failures.push({ metric: "correctness", reason: `must not say "${term}"` });
  }

  // Independent re-check of the harness guarantee: every 3+ digit number traces to this turn's tools
  const allowed = allowedNumbers(run.sources, [c.profile?.merit], [c.question]);
  const stray = ungroundedNumbers(run.text, allowed);
  if (stray.length) failures.push({ metric: "grounding", reason: `numbers not in any tool result: ${stray.join(", ")}` });

  return { ...base, status: failures.length ? "fail" : "pass", failures };
}

export interface Summary {
  total: number;
  skipped: number;
  toolAccuracy: number;
  factual: number;
  adversarial: number;
  grounding: number;
  fellBack: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  passed: boolean;
  misses: string[];
}

const rate = (ok: number, n: number) => (n === 0 ? 1 : ok / n);

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function summarise(cases: EvalCase[], results: CaseResult[]): Summary {
  const scored = results.filter((r) => r.status !== "skipped");
  const byId = new Map(cases.map((c) => [c.id, c]));
  const withTools = scored.filter((r) => byId.get(r.id)?.expectTools?.length);
  const adversarial = scored.filter((r) => r.group === "adversarial");
  const factual = scored.filter((r) => r.group !== "adversarial");

  const s = {
    total: results.length,
    skipped: results.length - scored.length,
    toolAccuracy: rate(withTools.filter((r) => !r.failures.some((f) => f.metric === "tools")).length, withTools.length),
    factual: rate(factual.filter((r) => r.status === "pass").length, factual.length),
    adversarial: rate(adversarial.filter((r) => r.status === "pass").length, adversarial.length),
    grounding: rate(scored.filter((r) => !r.failures.some((f) => f.metric === "grounding")).length, scored.length),
    fellBack: scored.filter((r) => r.fellBack).length,
    latencyP50Ms: percentile(scored.map((r) => r.latencyMs), 50),
    latencyP95Ms: percentile(scored.map((r) => r.latencyMs), 95),
  };
  const misses: string[] = [];
  if (s.toolAccuracy < THRESHOLDS.toolAccuracy) misses.push(`tool accuracy ${pct(s.toolAccuracy)} < ${pct(THRESHOLDS.toolAccuracy)}`);
  if (s.factual < THRESHOLDS.factual) misses.push(`factual pass rate ${pct(s.factual)} < ${pct(THRESHOLDS.factual)}`);
  if (s.adversarial < THRESHOLDS.adversarial) misses.push(`adversarial pass rate ${pct(s.adversarial)} < 100%`);
  if (s.grounding < THRESHOLDS.grounding) misses.push(`grounding ${pct(s.grounding)} < 100%`);
  if (scored.length === 0) misses.push("no case could be scored");
  return { ...s, passed: misses.length === 0, misses };
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
