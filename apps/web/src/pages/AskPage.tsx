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

const SOURCES = [
  { label: "2026 MHT-CET Information Brochure", detail: "Eligibility, seats, reservation rules" },
  { label: "CAP Round-wise Merit Lists", detail: "Closing merits for all branches · Rounds I–IV" },
  { label: "ARC Order of Merit", detail: "All-round closing ranks from 2024 & 2025" },
  { label: "MHT-CET Act & Rules", detail: "Seat matrix, freeze/float/slide definitions" },
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
            // malformed SSE line
          }
        }
      }

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

  return (
    <div className="ask-page">

      {/* Context bar */}
      {profile.meritNumber && (
        <div className="ask-context-bar">
          <span className="ask-ctx-chip ask-ctx-chip-merit">
            Merit {profile.meritNumber.toLocaleString("en-IN")}
          </span>
          {profile.category && <span className="ask-ctx-chip">{profile.category}</span>}
          {profile.gender && (
            <span className="ask-ctx-chip">{profile.gender === "M" ? "Male" : "Female"}</span>
          )}
          <span className="ask-ctx-label">injected as context</span>
        </div>
      )}

      <div className="ask-body">

        {/* Chat column */}
        <div className="ask-main">

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
                {/* Suggestion chips when chat is active */}
                {messages.length > 0 && !isTyping && (
                  <div className="ask-quick-chips">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} className="ask-quick-chip" onClick={() => sendMessage(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <div className="ask-usage-bar">
                  <span>{FREE_LIMIT - questionCount} of {FREE_LIMIT} free questions remaining</span>
                  {messages.length > 0 && (
                    <button className="ask-new-chat" onClick={() => { setMessages([]); setQuestionCount(0); }}>
                      New chat
                    </button>
                  )}
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

        {/* Sources sidebar */}
        <aside className="ask-sources">
          <div className="ask-sources-title">Sources</div>
          <div className="ask-sources-list">
            {SOURCES.map((s) => (
              <div key={s.label} className="ask-source-item">
                <span className="ask-source-icon">📄</span>
                <div className="ask-source-detail">
                  <span className="ask-source-label">{s.label}</span>
                  <span className="ask-source-meta">{s.detail}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="ask-sources-note">
            All answers are based on official MHT-CET CET Cell documents.
            <br />
            <Link to="/guide" className="ask-sources-link">Read our guide →</Link>
          </div>
        </aside>

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
