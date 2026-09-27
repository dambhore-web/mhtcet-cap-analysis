import { useState } from "react";
import "./GuidePage.css";

type Tab = "freeze" | "float" | "slide" | "faq";

interface Section {
  id: Tab;
  label: string;
  emoji: string;
}

const TABS: Section[] = [
  { id: "freeze", label: "Freeze", emoji: "🧊" },
  { id: "float", label: "Float", emoji: "🌊" },
  { id: "slide", label: "Slide", emoji: "⬇" },
  { id: "faq", label: "FAQ", emoji: "?" },
];

export function GuidePage() {
  const [tab, setTab] = useState<Tab>("freeze");

  return (
    <div className="guide-page">
      <header className="guide-header">
        <h1>CAP Allotment Guide</h1>
        <p>Freeze · Float · Slide — explained simply</p>
      </header>

      <div className="guide-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`guide-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="guide-tab-emoji">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="guide-body">
        {tab === "freeze" && <FreezeContent />}
        {tab === "float" && <FloatContent />}
        {tab === "slide" && <SlideContent />}
        {tab === "faq" && <FaqContent />}
      </div>
    </div>
  );
}

function FreezeContent() {
  return (
    <div className="guide-content">
      <div className="guide-card guide-card--freeze">
        <div className="guide-card-icon">🧊</div>
        <h2>Freeze</h2>
        <p className="guide-card-tagline">
          "I'm happy here. Lock it in."
        </p>
      </div>

      <div className="guide-section">
        <h3>What it means</h3>
        <p>
          You accept the allotted college and branch as your <strong>final choice</strong>.
          No further upgrades are attempted in subsequent rounds. Your seat is confirmed
          and you proceed to document verification.
        </p>
      </div>

      <div className="guide-section">
        <h3>When to choose Freeze</h3>
        <ul className="guide-list">
          <li>You got your first or second preference</li>
          <li>You're happy with the college and branch combination</li>
          <li>You don't want the risk of losing the current seat while waiting for a better one</li>
        </ul>
      </div>

      <div className="guide-section guide-section--warning">
        <h3>Important</h3>
        <p>
          Once you Freeze, you <strong>cannot participate in subsequent CAP rounds</strong>.
          Make sure you are fully satisfied with the allotment before selecting Freeze.
        </p>
      </div>

      <div className="guide-section">
        <h3>What happens next</h3>
        <ol className="guide-steps">
          <li>Report to the allotted institute within the stipulated date</li>
          <li>Submit original documents for verification</li>
          <li>Pay the first year fees to confirm admission</li>
        </ol>
      </div>

      <DecisionCard
        title="Should I Freeze?"
        yes="Your allotted college is your top/second choice"
        no="You believe a better college is achievable in the next round"
      />
    </div>
  );
}

function FloatContent() {
  return (
    <div className="guide-content">
      <div className="guide-card guide-card--float">
        <div className="guide-card-icon">🌊</div>
        <h2>Float</h2>
        <p className="guide-card-tagline">
          "Upgrade me if something better opens up — but keep me here otherwise."
        </p>
      </div>

      <div className="guide-section">
        <h3>What it means</h3>
        <p>
          You retain your current allotment <strong>and</strong> participate in the next
          round to try for a higher-preference seat. If a better seat opens, you get it
          automatically. If nothing better opens, your current seat is preserved.
        </p>
      </div>

      <div className="guide-section">
        <h3>When to choose Float</h3>
        <ul className="guide-list">
          <li>You want an upgrade but are okay with the current seat as a fallback</li>
          <li>You have higher preferences that are still within reach based on closing merits</li>
          <li>You are comfortable attending the current institute if no upgrade happens</li>
        </ul>
      </div>

      <div className="guide-section guide-section--info">
        <h3>Key rule</h3>
        <p>
          Float only moves <strong>up</strong> your preference list — never down.
          Your current seat acts as a safety net. You will never receive a less preferred
          allotment because you selected Float.
        </p>
      </div>

      <div className="guide-section">
        <h3>What happens next</h3>
        <ol className="guide-steps">
          <li>System checks if any of your higher preferences have an open seat</li>
          <li>If yes — you are moved to that seat; current allotment is released</li>
          <li>If no — your current allotment is carried forward unchanged</li>
          <li>You must report to whichever institute you end up in</li>
        </ol>
      </div>

      <DecisionCard
        title="Should I Float?"
        yes="You have preferences above the current one that are still plausible"
        no="Your current seat is already your top preference OR you don't want to risk any change"
      />
    </div>
  );
}

function SlideContent() {
  return (
    <div className="guide-content">
      <div className="guide-card guide-card--slide">
        <div className="guide-card-icon">⬇</div>
        <h2>Slide</h2>
        <p className="guide-card-tagline">
          "Keep me at this college — but upgrade my branch if possible."
        </p>
      </div>

      <div className="guide-section">
        <h3>What it means</h3>
        <p>
          You want to stay at the <strong>same institute</strong> but are willing to
          move to a better (higher-preference) branch within that institute. If a seat
          opens in a preferred branch at the same college, you slide into it.
          Your college does not change.
        </p>
      </div>

      <div className="guide-section">
        <h3>When to choose Slide</h3>
        <ul className="guide-list">
          <li>You are happy with the college but got a less-preferred branch</li>
          <li>E.g. allotted Mechanical but prefer Computer Science at the same institute</li>
          <li>You don't want to risk moving to a different college</li>
        </ul>
      </div>

      <div className="guide-section guide-section--info">
        <h3>Slide vs Float</h3>
        <p>
          <strong>Float</strong> can move you to a different college.<br />
          <strong>Slide</strong> keeps you at the same college, only changes the branch.
        </p>
        <p>
          Some students select both: Float for round-level upgrades, Slide as a fallback
          within the same campus.
        </p>
      </div>

      <div className="guide-section">
        <h3>What happens next</h3>
        <ol className="guide-steps">
          <li>System scans your preferred branches at the allotted college</li>
          <li>If a higher-preference branch has a vacancy, you slide into it</li>
          <li>College remains unchanged; only the branch changes</li>
          <li>If no preferred branch opens, current allotment is preserved</li>
        </ol>
      </div>

      <DecisionCard
        title="Should I Slide?"
        yes="You love the campus but want a better branch — CS instead of IT, for instance"
        no="The allotted branch is already your top choice at this college"
      />
    </div>
  );
}

const FAQS = [
  {
    q: "Can I change my option (Freeze/Float/Slide) after submitting?",
    a: "You can change your option until the option-form deadline. Once the round processing begins, the submitted option is final for that round.",
  },
  {
    q: "If I Float and get upgraded, do I lose the original seat?",
    a: "Yes — when you Float and receive a higher preference, the original seat is automatically released for other candidates. Ensure you are okay with this.",
  },
  {
    q: "Can I select both Float and Slide?",
    a: "Yes. Float applies across colleges; Slide applies within the same college. You can select Slide as a preference-within-college option and also Float to allow cross-college upgrades.",
  },
  {
    q: "What if I don't submit any option?",
    a: "If you fail to submit an option within the deadline, the default is typically treated as Freeze. Always verify the default for the current year in the official CAP brochure.",
  },
  {
    q: "How many CAP rounds are there?",
    a: "There are usually 3 main CAP rounds (Round I, II, III) followed by an Institute Level round and sometimes an ARC (Admission Reporting Centre) round for vacant seats. The exact count may vary year to year.",
  },
  {
    q: "What documents do I need at the reporting centre?",
    a: "Typically: MHT-CET mark statement, Class 10 & 12 mark sheets, domicile certificate, caste certificate (if applicable), Aadhaar, category validity certificate, and the allotment letter. Always check the official DTE circular for the current year.",
  },
];

function FaqContent() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="guide-content">
      <div className="guide-section">
        <h3>Common questions</h3>
      </div>
      <div className="guide-faq-list">
        {FAQS.map((faq, i) => (
          <div key={i} className={`guide-faq-item${open === i ? " open" : ""}`}>
            <button className="guide-faq-q" onClick={() => setOpen(open === i ? null : i)}>
              <span>{faq.q}</span>
              <span className="guide-faq-chevron">{open === i ? "▲" : "▼"}</span>
            </button>
            {open === i && <div className="guide-faq-a">{faq.a}</div>}
          </div>
        ))}
      </div>
      <p className="guide-disclaimer">
        This guide is based on historical CAP brochures. Always verify with the official DTE/CET Cell notification for the current year.
      </p>
    </div>
  );
}

function DecisionCard({ title, yes, no }: { title: string; yes: string; no: string }) {
  return (
    <div className="guide-decision">
      <div className="guide-decision-title">{title}</div>
      <div className="guide-decision-row">
        <span className="guide-decision-check">✓</span>
        <span>{yes}</span>
      </div>
      <div className="guide-decision-row">
        <span className="guide-decision-cross">✗</span>
        <span>{no}</span>
      </div>
    </div>
  );
}
