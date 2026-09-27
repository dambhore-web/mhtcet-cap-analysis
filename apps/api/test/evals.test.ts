import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { demoCache } from "../src/demo/demoCache.ts";
import { runAssistant, UNGROUNDED_FALLBACK, type ChatClient, type LlmToolCall } from "../src/assistant/run.ts";
import { allNumbers, parseCases, resolveCutoff, scoreCase, summarise, type CaseRun, type EvalCase } from "../evals/score.ts";

const cache = demoCache();
const cases = parseCases(readFileSync(join(import.meta.dirname, "../evals/assistant.v1.jsonl"), "utf8"));
const byId = (id: string) => cases.find((c) => c.id === id)!;

/** A scripted model: calls one tool, then answers with a template filled from the rows. */
function scripted(tool: string, args: object, answer: (rows: { id: string; label: string }[]) => string, calls: string[] = []): ChatClient {
  return {
    async complete({ messages }) {
      const last = messages[messages.length - 1];
      if (last.role !== "tool") {
        calls.push(tool);
        const toolCalls: LlmToolCall[] = [{ id: "t1", type: "function", function: { name: tool, arguments: JSON.stringify(args) } }];
        return { content: null, toolCalls };
      }
      return { content: answer(JSON.parse(last.content)), toolCalls: [] };
    },
  };
}

async function runCase(c: EvalCase, client: ChatClient, calls: string[]): Promise<CaseRun> {
  const out = await runAssistant({ client, cache, profile: c.profile ?? {}, history: [{ role: "user", content: c.question }] });
  return { ...out, toolCalls: calls, latencyMs: 5 };
}

describe("eval set", () => {
  it("has 50+ cases across every group, including 10 adversarial ones", () => {
    expect(cases.length).toBeGreaterThanOrEqual(50);
    const groups = new Set(cases.map((c) => c.group));
    expect([...groups].sort()).toEqual(["adversarial", "core", "eligibility", "out-of-scope", "process", "reach"]);
    expect(cases.filter((c) => c.group === "adversarial").length).toBeGreaterThanOrEqual(10);
  });

  it("computes every expected cutoff from the data (none typed in by hand)", () => {
    for (const c of cases.filter((x) => x.cutoff)) {
      expect(resolveCutoff(cache, c.cutoff!), c.id).toEqual(expect.any(Number));
    }
  });

  it("reads numbers the way people write them", () => {
    expect(allNumbers("closed at 1,781 in Round I and 12,34,567 overall; 45 seats")).toEqual([1781, 1234567, 45]);
  });
});

describe("scoring", () => {
  it("passes a grounded answer that quotes the right cutoff", async () => {
    const c = byId("EV-001");
    const calls: string[] = [];
    const client = scripted("getCutoffs", { collegeCode: "16006", branch: "Computer", seatType: "GOPENS" }, (rows) => {
      const r = rows.find((x) => x.label.includes("Round I (MH)"))!;
      return `It closed at ${r.label.split("closing ")[1]} in Round I [${r.id}].`;
    }, calls);
    const result = scoreCase(c, await runCase(c, client, calls), cache, UNGROUNDED_FALLBACK);
    expect(result.status).toBe("pass");
  });

  it("fails an invented number: the harness falls back and the case misses its cutoff", async () => {
    const c = byId("EV-001");
    const calls: string[] = [];
    const client = scripted("getCutoffs", { collegeCode: "16006" }, () => "It closed at 4321 in Round I.", calls);
    const result = scoreCase(c, await runCase(c, client, calls), cache, UNGROUNDED_FALLBACK);
    expect(result.status).toBe("fail");
    expect(result.fellBack).toBe(true);
    expect(result.failures.map((f) => f.metric)).toContain("correctness");
  });

  it("fails a missing tool call and a forbidden phrase", () => {
    const c: EvalCase = { id: "X", group: "reach", question: "q", expectTools: ["findOptions"], mustNotInclude: ["guarantee"] };
    const run: CaseRun = { text: "I guarantee you a seat.", sources: [], grounded: true, toolCalls: ["searchColleges"], latencyMs: 1 };
    const r = scoreCase(c, run, cache, UNGROUNDED_FALLBACK);
    expect(r.failures.map((f) => f.metric).sort()).toEqual(["correctness", "tools"]);
  });

  it("flags a stray number even if the harness let it through", () => {
    const c: EvalCase = { id: "X", group: "core", question: "q" };
    const run: CaseRun = { text: "The cutoff was 5555.", sources: [], grounded: true, toolCalls: [], latencyMs: 1 };
    expect(scoreCase(c, run, cache, UNGROUNDED_FALLBACK).failures).toEqual([{ metric: "grounding", reason: "numbers not in any tool result: 5555" }]);
  });

  it("skips, rather than fails, a case whose row is not in the loaded data", () => {
    const c: EvalCase = { id: "X", group: "core", question: "q", cutoff: { college: "99999", branch: "Computer", seatType: "GOPENS", round: "I" } };
    const run: CaseRun = { text: "", sources: [], grounded: false, toolCalls: [], latencyMs: 1 };
    expect(scoreCase(c, run, cache, UNGROUNDED_FALLBACK).status).toBe("skipped");
  });

  it("gates on every threshold: one adversarial miss fails the run", () => {
    const cs: EvalCase[] = [
      { id: "A", group: "core", question: "q", expectTools: ["getCutoffs"] },
      { id: "B", group: "adversarial", question: "q" },
    ];
    const ok = { failures: [], toolCalls: [], latencyMs: 10, fellBack: false, answer: "" };
    const pass = summarise(cs, [{ ...ok, id: "A", group: "core", status: "pass" }, { ...ok, id: "B", group: "adversarial", status: "pass" }]);
    expect(pass.passed).toBe(true);
    const fail = summarise(cs, [
      { ...ok, id: "A", group: "core", status: "pass" },
      { ...ok, id: "B", group: "adversarial", status: "fail", failures: [{ metric: "correctness", reason: "x" }] },
    ]);
    expect(fail.passed).toBe(false);
    expect(fail.misses[0]).toMatch(/adversarial/);
  });
});

describe("errors", () => {
  it("reports a model or network error as an error, not as a stray number in the answer", () => {
    const c: EvalCase = { id: "X", group: "core", question: "q", expectTools: ["getCutoffs"] };
    const run: CaseRun = { text: "", sources: [], grounded: false, toolCalls: [], latencyMs: 60, error: "404 model not found" };
    const r = scoreCase(c, run, cache, UNGROUNDED_FALLBACK);
    expect(r.failures).toEqual([{ metric: "error", reason: "404 model not found" }]);
  });
});
