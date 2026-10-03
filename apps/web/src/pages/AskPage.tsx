import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../lib/ProfileContext";
import { api } from "../lib/api";
import { PAYMENTS_ENABLED, PLANS } from "../lib/plans";
import { formatNumber } from "../lib/format";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { usePageMeta } from "../lib/seo";
import "./AskPage.css";

const FREE_LIMIT = PLANS.free.askQuestions;

const SUGGESTIONS = [
  "What's the difference between Freeze, Float, and Slide?",
  "What documents do I need at the CAP reporting centre?",
  "Can I change my preferences after Round I allotment?",
  "What is TFWS and how do I qualify?",
];

interface Source {
  id: string;
  kind: string;
  label: string;
  collegeCode?: string;
  round?: string;
  list?: string;
  year?: number;
  sourceFile?: string | null;
  sourcePage?: number | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  sources?: Source[];
}

const FOLLOW_UPS = [
  "Which of my options were safest in Round I?",
  "Explain my seat type in plain words",
  "Should I float or freeze after Round I?",
];


export function AskPage() {
  usePageMeta({ title: "Ask GetMeCollege", noindex: true });
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
        {
          merit: profile.meritNumber ?? undefined,
          category: profile.category ?? undefined,
          gender: profile.gender ?? undefined,
          homeUniversity: profile.homeUniversity || undefined,
        },
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
            const payload = JSON.parse(line.slice(6)) as { delta?: string; done?: boolean; error?: string; sources?: Source[] };
            if (payload.sources) {
              const sources = payload.sources;
              setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, sources } : msg)));
            }
            if (payload.error) {
              const err = payload.error;
              setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, text: err } : msg)));
            }
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

  const latestSources = [...messages].reverse().find((m) => m.role === "assistant" && m.sources?.length)?.sources ?? [];
  const chips = [
    profile.meritNumber ? `Merit ${formatNumber(profile.meritNumber)}` : null,
    categoryLabel,
    profile.gender === "F" ? "Female" : "Male",
    profile.homeUniversity || null,
  ].filter(Boolean) as string[];

  return (
    <div className="page ask-page">
      <PageHeader
        title="Ask GetMeCollege"
        subtitle="Answers come from the official cutoff lists, and every number is cited. Past cutoffs are not a guarantee of admission."
        actions={
          messages.length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMessages([])}>
              <Icon name="plus" size={16} />
              New chat
            </button>
          )
        }
      />

      <div className="ask-context" aria-label="Answering for">
        <span className="label">Answering for</span>
        {chips.map((c) => <span key={c} className="ask-chip">{c}</span>)}
        <Link to="/profile/details" className="ask-context-edit">{profile.meritNumber ? "Edit" : "Add your merit number"}</Link>
      </div>

      <div className="ask-layout">
      <div className="ask-main">
      <div className="ask-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="ask-empty">
            <Icon name="chat" size={28} className="ask-empty-icon" />
            <h2>Ask anything about MHT-CET CAP</h2>
            <p>Cutoffs, your chances, seat types, freeze or float. Try one of these:</p>
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
              <FormattedText text={msg.text} messageId={msg.id} />
              {msg.role === "assistant" && !msg.streaming && msg.sources && msg.sources.length > 0 && (
                <details className="ask-sources">
                  <summary>{msg.sources.length} {msg.sources.length === 1 ? "source" : "sources"}</summary>
                  <SourceList sources={msg.sources} messageId={msg.id} />
                </details>
              )}
            </div>
          </div>
        ))}

        {!isTyping && messages.length > 0 && messages[messages.length - 1].role === "assistant" && !limitReached && (
          <div className="ask-suggestions ask-followups" aria-label="Suggested follow-ups">
            {FOLLOW_UPS.map((s) => (
              <button key={s} type="button" className="ask-suggestion" onClick={() => sendMessage(s)}>{s}</button>
            ))}
          </div>
        )}

        {isTyping && (
          <div className="ask-bubble-wrap assistant">
            <span className="ask-ai-dot" aria-hidden="true"><Icon name="sparkle" size={14} /></span>
            <div className="ask-bubble assistant ask-typing" role="status" aria-label="GetMeCollege is typing">
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
              {PAYMENTS_ENABLED ? (
                <>
                  <strong>You've used all {FREE_LIMIT} free questions</strong>
                  <span>The {PLANS.seasonPass.name} includes unlimited questions.</span>
                </>
              ) : serverLimited ? (
                <>
                  <strong>You've reached the question limit for this hour</strong>
                  <span>Try again later. Find colleges and the CAP guide work as usual.</span>
                </>
              ) : (
                <>
                  <strong>That's {FREE_LIMIT} questions for this conversation</strong>
                  <span>Reload the page to start a new one.</span>
                </>
              )}
            </div>
            {PAYMENTS_ENABLED && <Link to="/plans" className="btn btn-accent btn-sm">See plans</Link>}
          </div>
        ) : (
          <>
            <div className="ask-usage-bar">
              <span>{FREE_LIMIT - questionCount} of {FREE_LIMIT} {PAYMENTS_ENABLED ? "free " : ""}questions left</span>
              {PAYMENTS_ENABLED && <Link to="/plans" className="ask-upgrade-link">Unlimited with {PLANS.seasonPass.name}</Link>}
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

      <aside className="ask-side" aria-label="Sources and how answers work">
        <section className="card ask-side-card">
          <h2 className="label">Sources in the latest answer</h2>
          {latestSources.length ? <SourceList sources={latestSources} /> : <p>Sources appear here after an answer.</p>}
        </section>
        <section className="card ask-side-card">
          <h2 className="label">How Ask GetMeCollege works</h2>
          <p>It looks up the official cutoff lists for you, then explains the result. If a number isn't in the data, it says so instead of guessing.</p>
          <p>It can't tell you this year's cutoffs: nobody knows them yet.</p>
        </section>
      </aside>
      </div>
    </div>
  );
}

function SourceList({ sources, messageId }: { sources: Source[]; messageId?: string }) {
  return (
    <ol className="ask-source-list">
      {sources.map((s) => (
        <li key={s.id} id={messageId ? `${messageId}-${s.id}` : undefined}>
          <span className="ask-source-id">{s.id}</span>
          <span>
            {s.collegeCode ? <Link to={`/colleges/${s.collegeCode}`}>{s.label}</Link> : s.label}
            {s.sourceFile && (
              <span className="ask-source-file">
                {s.sourceFile}
                {s.sourcePage ? `, page ${s.sourcePage}` : ""}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Bold, line breaks and [S3]-style citations that jump to the source list. */
function FormattedText({ text, messageId }: { text: string; messageId: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>
          {line.split(/(\*\*[^*]+\*\*|\[S\d+\])/g).map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
            const cite = /^\[(S\d+)\]$/.exec(part);
            if (cite)
              return (
                <a key={i} className="ask-cite" href={`#${messageId}-${cite[1]}`} aria-label={`source ${cite[1]}`}>
                  {cite[1]}
                </a>
              );
            return <span key={i}>{part}</span>;
          })}
          {li < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}
