import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import { api } from "../lib/api";
import { PLANS } from "../lib/plans";
import { formatNumber } from "../lib/format";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import "./AskPage.css";

const FREE_LIMIT = PLANS.free.askQuestions;

const SUGGESTIONS = [
  "What's the difference between Freeze, Float, and Slide?",
  "What documents do I need at the CAP reporting centre?",
  "Can I change my preferences after Round I allotment?",
  "What is TFWS and how do I qualify?",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}


export function AskPage() {
  const { profile } = useProfile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [serverLimited, setServerLimited] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const limitReached = questionCount >= FREE_LIMIT || serverLimited;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function sendMessage(text: string) {
    if (!text.trim() || limitReached || isTyping) return;
    const trimmed = text.trim();
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: trimmed };

    // Snapshot the full conversation history to send to the API
    const history = messages
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));

    setMessages((m) => [...m, userMsg]);
    setInput("");
    setQuestionCount((n) => n + 1);
    setIsTyping(true);

    const assistantId = (Date.now() + 1).toString();

    try {
      const reader = await api.assistantStream(
        [...history, { role: "user", content: trimmed }],
        { merit: profile.meritNumber ?? undefined, category: profile.category ?? undefined, gender: profile.gender ?? undefined },
      );

      if (!reader) throw new Error("no_stream");

      // Add empty streaming message
      setMessages((m) => [...m, { id: assistantId, role: "assistant", text: "", streaming: true }]);
      setIsTyping(false);

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as { delta?: string; done?: boolean; error?: string };
            if (payload.delta) {
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantId ? { ...msg, text: msg.text + payload.delta } : msg
                )
              );
            }
            if (payload.done || payload.error) break;
          } catch {
            // malformed SSE line, skip
          }
        }
      }

      // Mark streaming complete
      setMessages((m) =>
        m.map((msg) => (msg.id === assistantId ? { ...msg, streaming: false } : msg))
      );
    } catch (err: unknown) {
      setIsTyping(false);
      const code = (err as { code?: string }).code;
      if (code === "rate_limited") {
        setServerLimited(true);
        setMessages((m) => m.filter((msg) => msg.id !== assistantId));
      } else {
        const text = code === "assistant_unavailable"
          ? "The AI assistant is currently unavailable. Please try again later."
          : "Something went wrong. Please try again.";
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, text, streaming: false } : msg))
        );
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === (profile.category ?? ""))?.label ?? "Open";
  const contextLine = profile.meritNumber
    ? `Answers use your merit ${formatNumber(profile.meritNumber)} and ${categoryLabel} category.`
    : "Add your merit number in My details for answers about your own chances.";

  return (
    <div className="page page--narrow ask-page">
      <PageHeader
        title="Ask Compass"
        subtitle={contextLine}
        actions={
          messages.length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMessages([])}>
              <Icon name="plus" size={16} />
              New chat
            </button>
          )
        }
      />

      <div className="ask-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="ask-empty">
            <Icon name="chat" size={28} className="ask-empty-icon" />
            <h2>Ask anything about MHT-CET CAP</h2>
            <p>Cutoffs, eligibility, documents, freeze or float. Answers point to official sources. Try one of these:</p>
            <div className="ask-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="ask-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`ask-bubble-wrap ${msg.role}`}>
            {msg.role === "assistant" && <span className="ask-ai-dot" aria-hidden="true"><Icon name="sparkle" size={14} /></span>}
            <div className={`ask-bubble ${msg.role}`}>
              <FormattedText text={msg.text} />
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="ask-bubble-wrap assistant">
            <span className="ask-ai-dot" aria-hidden="true"><Icon name="sparkle" size={14} /></span>
            <div className="ask-bubble assistant ask-typing" role="status" aria-label="Compass is typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="ask-bottom">
        {limitReached ? (
          <div className="ask-limit-banner">
            <div className="ask-limit-text">
              <strong>You've used all {FREE_LIMIT} free questions</strong>
              <span>The {PLANS.seasonPass.name} includes unlimited questions.</span>
            </div>
            <Link to="/plans" className="btn btn-accent btn-sm">See plans</Link>
          </div>
        ) : (
          <>
            <div className="ask-usage-bar">
              <span>{FREE_LIMIT - questionCount} of {FREE_LIMIT} free questions left</span>
              <Link to="/plans" className="ask-upgrade-link">Unlimited with {PLANS.seasonPass.name}</Link>
            </div>
            <div className="ask-input-row">
              <label htmlFor="ask-input" className="sr-only">Your question</label>
              <textarea
                id="ask-input"
                ref={inputRef}
                className="ask-input"
                placeholder="Ask about MHT-CET admissions…"
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
              />
              <button
                type="button"
                className="ask-send"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                aria-label="Send question"
              >
                <Icon name="arrowUp" size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part.split("\n").map((line, j) => (
              <span key={`${i}-${j}`}>{line}{j < part.split("\n").length - 1 ? <br /> : null}</span>
            ))
      )}
    </>
  );
}
