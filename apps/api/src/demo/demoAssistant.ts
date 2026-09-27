import type { ChatClient, LlmMessage } from "../assistant/run.ts";

/**
 * A deterministic stand-in for the language model in demo mode. It looks the question up with
 * the real tools and cites the first rows, so the Ask page works end to end without an API key.
 */
export const demoAssistant: ChatClient = {
  async complete({ messages }) {
    const toolMsgs = messages.filter((m): m is Extract<LlmMessage, { role: "tool" }> => m.role === "tool");
    const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (toolMsgs.length === 0) {
      const q = String(question);
      if (/freeze|float|slide/i.test(q)) return call("capRules", {});
      const STOP = new Set(["What", "Which", "Where", "When", "Should", "Could", "Would", "Explain", "Round"]);
      const word =
        q.match(/\b[A-Z]{3,}\b/)?.[0] ??
        (q.match(/\b[A-Z][a-z]{3,}\b/g) ?? []).find((w) => !STOP.has(w)) ??
        "Institute";
      return call("searchColleges", { query: word });
    }
    const rows = JSON.parse(toolMsgs[toolMsgs.length - 1].content) as { id: string; label: string }[] | { error?: string };
    if (!Array.isArray(rows) || rows.length === 0) {
      return { content: "I couldn't find that in the data. Try naming the college.", toolCalls: [] };
    }
    const text = rows.slice(0, 3).map((r) => `${r.label} [${r.id}]`).join("\n");
    return { content: `Here is what the data shows (demo mode):\n${text}`, toolCalls: [] };
  },
};

function call(name: string, args: object) {
  return {
    content: null,
    toolCalls: [{ id: `demo-${name}`, type: "function" as const, function: { name, arguments: JSON.stringify(args) } }],
  };
}
