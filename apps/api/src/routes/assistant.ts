import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import Groq from "groq-sdk";
import { checkRateLimit, clientIp } from "../rateLimit.ts";
import type { AppCache } from "../startup.ts";
import { runAssistant, type ChatClient, type Profile } from "../assistant/run.ts";

/** Tool-capable model; the provider and model are an open decision (#19). */
export const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// 20 questions per IP per hour: coarse protection until per-user auth is in place (#15)
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 20;
const MAX_HISTORY = 12;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function groqClient(apiKey: string): ChatClient {
  const groq = new Groq({ apiKey });
  return {
    async complete({ messages, tools }) {
      const res = await groq.chat.completions.create({
        model: MODEL,
        // The SDK's message union is structurally the same as LlmMessage
        messages: messages as Parameters<typeof groq.chat.completions.create>[0]["messages"],
        ...(tools.length ? { tools: tools.map((t) => ({ type: "function" as const, function: t })), tool_choice: "auto" as const } : {}),
        temperature: 0.2,
        max_tokens: 900,
      });
      const msg = res.choices[0]?.message;
      return {
        content: msg?.content ?? null,
        toolCalls: (msg?.tool_calls ?? []).map((t) => ({ id: t.id, type: "function" as const, function: { name: t.function.name, arguments: t.function.arguments } })),
      };
    },
  };
}

/** POST /api/assistant: grounded answer streamed as SSE events {sources} · {delta}* · {done}. */
export async function postAssistant(c: Context, cache: AppCache, injected?: ChatClient) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!injected && !apiKey) {
    return c.json({ error: "assistant_unavailable" }, 503);
  }
  const client = injected ?? groqClient(apiKey!);

  const ip = clientIp(c.req);
  if (!checkRateLimit(ip, RATE_WINDOW_MS, RATE_MAX)) {
    return c.json({
      error: "rate_limited",
      message: "You've reached the free question limit for this hour. Upgrade for unlimited access.",
      upgradeUrl: "/plans",
    }, 429);
  }

  let body: { messages: ChatMessage[]; profile?: Profile };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const { messages, profile } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: "messages_required" }, 400);
  }
  const history = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  return streamSSE(c, async (stream) => {
    try {
      const result = await runAssistant({ client, cache, profile: profile ?? {}, history });
      await stream.writeSSE({ data: JSON.stringify({ sources: result.sources, grounded: result.grounded }) });
      // Chunk the checked answer so the page can render it progressively
      for (const piece of result.text.match(/[\s\S]{1,48}(\s|$)/g) ?? [result.text]) {
        await stream.writeSSE({ data: JSON.stringify({ delta: piece }) });
      }
      await stream.writeSSE({ data: JSON.stringify({ done: true }) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(JSON.stringify({ ts: new Date().toISOString(), event: "assistant_error", message: msg }));
      await stream.writeSSE({ data: JSON.stringify({ error: "The assistant couldn't answer just now. Please try again." }) });
    }
  });
}
