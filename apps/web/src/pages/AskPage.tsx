import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import { api } from "../lib/api";
import "./AskPage.css";

const FREE_LIMIT = 3;

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const limitReached = questionCount >= FREE_LIMIT;

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
    } catch {
      setIsTyping(false);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, text: "Sorry, the assistant is unavailable right now. Please try again later.", streaming: false }
            : msg
        )
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const contextLine = profile.meritNumber
    ? `Merit ${profile.meritNumber.toLocaleString("en-IN")}${profile.category ? ` · ${profile.category}` : ""}`
    : null;

  return (
    <div className="ask-page">
      <header className="ask-header">
        <div className="ask-header-left">
          <span className="ask-header-icon">✦</span>
          <div>
            <h1>Ask Compass</h1>
            {contextLine && <span className="ask-context-line">{contextLine} · auto-injected</span>}
          </div>
        </div>
        {messages.length > 0 && (
          <button className="ask-new-chat" onClick={() => { setMessages([]); setQuestionCount(0); }}>
            New chat
          </button>
        )}
      </header>

      <div className="ask-messages">
        {messages.length === 0 && (
          <div className="ask-empty">
            <div className="ask-empty-icon">✦</div>
            <h2>Ask me anything about MHT-CET CAP</h2>
            <p>Cutoffs, eligibility, documents, Freeze vs Float — I'll explain with official sources.</p>
            <div className="ask-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="ask-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`ask-bubble-wrap ${msg.role}`}>
            {msg.role === "assistant" && <span className="ask-ai-dot">✦</span>}
            <div className={`ask-bubble ${msg.role}`}>
              <FormattedText text={msg.text} />
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="ask-bubble-wrap assistant">
            <span className="ask-ai-dot">✦</span>
            <div className="ask-bubble assistant ask-typing">
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
              <strong>You've used {FREE_LIMIT} of {FREE_LIMIT} free questions</strong>
              <span>Upgrade to ask unlimited questions</span>
            </div>
            <Link to="/plans" className="ask-limit-cta">See plans</Link>
          </div>
        ) : (
          <>
            <div className="ask-usage-bar">
              <span>{FREE_LIMIT - questionCount} of {FREE_LIMIT} free questions remaining</span>
              <Link to="/plans" className="ask-upgrade-link">Upgrade</Link>
            </div>
            <div className="ask-input-row">
              <textarea
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
                className="ask-send"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                aria-label="Send"
              >
                ↑
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
