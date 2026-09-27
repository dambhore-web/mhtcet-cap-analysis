import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
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

const COMING_SOON_REPLY = `The AI admissions assistant is coming in October 2026. In the meantime:

• Use the **Rank Finder** (Find tab) to see all colleges where you qualify
• Visit any **College page** for cutoff tables by round and seat type
• Check the **Freeze/Float/Slide** guide under your My List tab after allotment

The assistant will be trained on official CET Cell notifications, DTE circulars, and past CAP brochures — and will cite every source.`;

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
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setQuestionCount((n) => n + 1);
    setIsTyping(true);

    // Simulate streaming delay — replace with real SSE from POST /api/assistant
    await new Promise((r) => setTimeout(r, 800));
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      text: COMING_SOON_REPLY,
    };
    setIsTyping(false);
    setMessages((m) => [...m, assistantMsg]);
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
