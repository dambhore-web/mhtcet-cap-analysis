import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import Groq from "groq-sdk";
import { checkRateLimit, clientIp } from "../rateLimit.ts";

const MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are Compass, an AI assistant for MHT-CET CAP 2026 engineering admissions in Maharashtra, India.

You help candidates with:
- Reading and understanding cutoff tables (merit numbers, seat types, CAP rounds I/II/III)
- Seat types: GOPENS (Open/General), GOPENH (Home University), LOPENS (Ladies), GOBCS (OBC), GOBCSH (OBC Home University), EWS, TFWS, PWD, Defence, Orphan, Minority
- Eligibility: MH State candidature vs AI (All India), Home University seats, ladies seats at Stage I/II
- What Freeze, Float, and Slide mean and when to choose each
- Documents to carry to a CAP reporting centre (Aadhaar, HSC marksheet, caste certificate if applicable, JEE scorecard for AI seats)
- Timeline: Round I allotment → Freeze/Float/Slide → Round II → Round III → spot round
- Understanding the merit list (lower merit number = better rank)

Be concise and accurate. Always prefer citing the CET Cell (cetcell.mahacet.org) or DTE Maharashtra as sources.
If you are not sure about a specific number, year, or rule, say so clearly.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ProfileCtx {
  merit?: number | null;
  category?: string | null;
  gender?: string | null;
}

function buildSystemMessage(profile?: ProfileCtx): string {
  if (!profile?.merit && !profile?.category) return SYSTEM_PROMPT;
  const lines: string[] = [];
  if (profile.merit) lines.push(`Candidate's MHT-CET state merit number: ${profile.merit.toLocaleString("en-IN")} (lower = better rank)`);
  if (profile.category) lines.push(`Candidate's category: ${profile.category}`);
  if (profile.gender) lines.push(`Gender: ${profile.gender === "M" ? "Male" : "Female"}`);
  return `${SYSTEM_PROMPT}\n\n${lines.join("\n")}`;
}

// 20 questions per IP per hour — coarse protection until per-user auth is in place (#15)
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 20;

export async function postAssistant(c: Context) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return c.json({ error: "assistant_unavailable" }, 503);
  }

  const ip = clientIp(c.req);
  if (!checkRateLimit(ip, RATE_WINDOW_MS, RATE_MAX)) {
    return c.json({
      error: "rate_limited",
      message: "You've reached the free question limit for this hour. Upgrade for unlimited access.",
      upgradeUrl: "/plans",
    }, 429);
  }

  let body: { messages: ChatMessage[]; profile?: ProfileCtx };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const { messages, profile } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: "messages_required" }, 400);
  }

  const groq = new Groq({ apiKey });

  return streamSSE(c, async (stream) => {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystemMessage(profile) },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
        max_tokens: 800,
        temperature: 0.4,
      });

      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          await stream.writeSSE({ data: JSON.stringify({ delta }) });
        }
      }
      await stream.writeSSE({ data: JSON.stringify({ done: true }) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      await stream.writeSSE({ data: JSON.stringify({ error: msg }) });
    }
  });
}
