import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { CATEGORIES } from "@mhtcet/core";
import type { Context } from "hono";
import Groq from "groq-sdk";
import { checkRateLimit, clientIp } from "../rateLimit.ts";
import type { AppCache } from "../startup.ts";
import { runAssistant, type ChatClient, type Profile } from "../assistant/run.ts";

/**
 * Tool-capable Groq model; the provider and model are an open decision (#19). The previous
 * default, llama-3.3-70b-versatile, was withdrawn by Groq (404). Chosen on the eval set.
 */
export const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/**
 * Reasoning models think before answering. Keep that short, hide it from the response, and leave
 * room for it in the token budget, or the visible answer can come back empty.
 */
export function reasoningOptions(model: string): { reasoning_effort?: "none" | "low" | "medium"; include_reasoning?: boolean } {
  // Medium: tool arguments (seat type, round) are where the model slips, and thinking helps there
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: "medium", include_reasoning: false };
  if (model.startsWith("qwen/qwen3")) return { reasoning_effort: "none" };
  return {};
}

// 20 questions per IP per hour: coarse protection until per-user auth is in place (#15)
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 20;
const MAX_HISTORY = 12;

/**
 * The request body. The profile is written into the model's prompt, so every field is held to a
 * strict shape: no free text that could smuggle instructions (newlines, markup) into it.
 */
const PlainText = z.string().trim().max(120).regex(/^[^\n\r<>{}]*$/, "plain text only");
export const AssistantRequest = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) })).min(1).max(50),
  profile: z.object({
    merit: z.number().int().min(1).max(1_000_000).nullish(),
    category: z.enum(CATEGORIES).nullish(),
    gender: z.enum(["M", "F"]).nullish(),
    homeUniversity: PlainText.nullish(),
  }).default({}),
});

export function groqClient(apiKey: string): ChatClient {
  const groq = new Groq({ apiKey });
  return {
    async complete({ messages, tools }) {
      let res;
      try {
        res = await groq.chat.completions.create({
          model: MODEL,
          // The SDK's message union is structurally the same as LlmMessage
          messages: messages as Parameters<typeof groq.chat.completions.create>[0]["messages"],
          ...(tools.length ? { tools: tools.map((t) => ({ type: "function" as const, function: t })), tool_choice: "auto" as const } : {}),
          temperature: 0.2,
          max_completion_tokens: 2048,
          ...reasoningOptions(MODEL),
        });
      } catch (e) {
        // The model produced a tool call Groq couldn't accept (malformed, or with no tools on
        // offer). Treat it as no answer: the runner then sends the safe fallback, not a 500.
        if (e instanceof Groq.APIError && e.status === 400 && /tool_use_failed/.test(e.message)) return { content: null, toolCalls: [] };
        throw e;
      }
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
  if (!checkRateLimit(`assistant:${ip}`, RATE_WINDOW_MS, RATE_MAX)) {
    return c.json({
      error: "rate_limited",
      message: "You've reached the free question limit for this hour. Upgrade for unlimited access.",
      upgradeUrl: "/plans",
    }, 429);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = AssistantRequest.safeParse(raw);
  if (!parsed.success) {
    const noMessages = parsed.error.issues.some((i) => i.path[0] === "messages");
    return c.json({ error: noMessages ? "messages_required" : "invalid_request" }, 400);
  }

  const { messages, profile } = parsed.data;
  const history = messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  return streamSSE(c, async (stream) => {
    try {
      const result = await runAssistant({ client, cache, profile: profile as Profile, history });
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
