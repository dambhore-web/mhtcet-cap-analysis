import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Icon, type IconName } from "../components/Icon";
import { seatTypeLabel, seatTypeParts } from "../lib/seatType";
import { usePageMeta } from "../lib/seo";
import "./GuidePage.css";

type Tab = "how" | "freeze" | "float" | "slide" | "codes" | "faq";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "how", label: "How CAP works", icon: "steps" },
  { id: "freeze", label: "Freeze", icon: "lock" },
  { id: "float", label: "Float", icon: "arrowUp" },
  { id: "slide", label: "Slide", icon: "arrowRight" },
  { id: "codes", label: "Seat codes", icon: "tag" },
  { id: "faq", label: "FAQ", icon: "help" },
];

/** Older links used ?tab=decide for the freeze / float / slide section. */
function parseTab(v: string | null): Tab {
  if (v === "decide") return "freeze";
  return TABS.some((t) => t.id === v) ? (v as Tab) : "how";
}

export function GuidePage() {
  usePageMeta({ title: "How MHT-CET CAP works — rounds, seat codes, freeze, float, slide", description: "A plain-language guide to the CAP option form, the rounds, auto-freeze, freeze, float and slide, and seat type codes such as GOPENS and TFWS." });
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("tab"));
  const setTab = (t: Tab) => setParams(t === "how" ? {} : { tab: t }, { replace: true });

  return (
    <div className="page page--narrow guide-page">
      <PageHeader
        title="CAP guide"
        subtitle="How the Centralised Admission Process works, what to do after each allotment, and what the seat codes mean."
      />

      <div className="guide-tabs" role="tablist" aria-label="Guide sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`guide-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="guide-panel"
            className={`guide-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="guide-body" role="tabpanel" id="guide-panel" aria-labelledby={`guide-tab-${tab}`}>
        {tab === "how" && <HowContent />}
        {tab === "freeze" && <FreezeContent />}
        {tab === "float" && <FloatContent />}
        {tab === "slide" && <SlideContent />}
        {tab === "codes" && <CodesContent />}
        {tab === "faq" && <FaqContent />}
      </div>
    </div>
  );
}

const CAP_STEPS = [
  { title: "Register and verify documents", body: "Fill the CAP application on the CET Cell portal and get your documents verified (e-scrutiny or at a facilitation centre)." },
  { title: "Check the merit lists", body: "A provisional merit list is published first, then the final state merit list. Your state merit number is your rank in it." },
  { title: "Fill the option form", body: "List up to 300 choice codes (college + branch) in the order you prefer them. Order matters: you are allotted the highest choice your rank qualifies for." },
  { title: "Round I allotment", body: "CET Cell publishes the allotment. If you got a seat, you choose to freeze, float or slide, and report online or at the institute." },
  { title: "Rounds II and III", body: "Seats left after each round are re-allotted. You can edit your option form between rounds. Later rounds usually close at higher (easier) ranks." },
  { title: "Report to the institute", body: "Once you freeze a seat, report to the college with original documents and pay the fees before the deadline." },
];

function HowContent() {
  return (
    <div className="guide-content">
      <ol className="guide-timeline">
        {CAP_STEPS.map((step, i) => (
          <li key={step.title}>
            <span className="guide-timeline-num" aria-hidden="true">{i + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="guide-section guide-section--info">
        <h3>Where Compass helps</h3>
        <p>
          <Link to="/find">Find</Link> shows which choice codes last year's closing ranks put within reach. Save them to your{" "}
          <Link to="/list">option form</Link>, order them, and <Link to="/simulator">test the order</Link> before you fill the
          real form on the CET Cell portal.
        </p>
      </div>
      <p className="guide-disclaimer">
        Dates and rules change every year. Always follow the official CAP information brochure and CET Cell notices.
      </p>
    </div>
  );
}

const CODE_EXAMPLES = ["GOPENS", "GOPENH", "GOPENO", "LOPENS", "GOBCH", "LSCS", "GNT2S", "DEFOPENS", "PWDOPENH", "TFWS", "EWS"];

/** Type a seat code from a cutoff list and see its parts: the pattern is learned, not looked up. */
function SeatCodeDecoder() {
  const [code, setCode] = useState("GOBCS");
  const parts = seatTypeParts(code);
  return (
    <div className="guide-decoder">
      <div>
        <label className="label" htmlFor="guide-code">Seat code</label>
        <input id="guide-code" className="guide-code-in" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} />
        <div className="guide-code-examples">
          {["GOPENS", "LOBCH", "PWDRSCS", "DEFOBCS", "TFWS"].map((c) => (
            <button key={c} type="button" className="chip" onClick={() => setCode(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="guide-code-parts-live" aria-live="polite">
        {parts ? (
          parts.map((p) => (
            <div key={p.part} className="guide-code-part">
              <span className="guide-code-part-code">{p.code}</span>
              <span className="label">{p.part}</span>
              <span className="guide-code-part-meaning">{p.meaning}</span>
            </div>
          ))
        ) : (
          <p className="guide-code-none">Not a seat code we recognise. Codes look like <code>GOPENS</code>: quota, then category, then level.</p>
        )}
      </div>
    </div>
  );
}

function CodesContent() {
  return (
    <div className="guide-content">
      <div className="guide-section">
        <h3>Decode a seat code</h3>
        <SeatCodeDecoder />
      </div>
      <div className="guide-section">
        <h3>Reading a seat code</h3>
        <p>
          Most seat codes join three parts: <strong>who</strong> the seat is for, the <strong>category</strong>, and the{" "}
          <strong>level</strong>. For example <code>GOPENH</code> is G (general) + OPEN + H (home university).
        </p>
        <dl className="guide-code-parts">
          <div><dt>First letter(s)</dt><dd>G general · L ladies · DEF defence · PWD disability</dd></div>
          <div><dt>Category</dt><dd>OPEN, OBC, SEBC, SC, ST, VJ, NT1 (NT-B), NT2 (NT-C), NT3 (NT-D)</dd></div>
          <div><dt>Last letter</dt><dd>S state level · H home university · O other than home university</dd></div>
        </dl>
      </div>
      <div className="guide-section">
        <h3>Examples</h3>
        <div className="table-scroll">
          <table className="guide-code-table">
            <thead>
              <tr><th scope="col">Code</th><th scope="col">Meaning</th></tr>
            </thead>
            <tbody>
              {CODE_EXAMPLES.map((c) => (
                <tr key={c}><td><code>{c}</code></td><td>{seatTypeLabel(c)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="guide-disclaimer">
        TFWS, EWS, minority and orphan seats have their own codes and eligibility rules. <Link to="/eligibility">Check which seats you can apply for</Link>.
      </p>
    </div>
  );
}

function FreezeContent() {
  return (
    <div className="guide-content">
      <div className="guide-card guide-card--freeze">
        <div className="guide-card-icon"><Icon name="lock" size={28} /></div>
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
        <div className="guide-card-icon"><Icon name="arrowUp" size={28} /></div>
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
        <div className="guide-card-icon"><Icon name="arrowRight" size={28} /></div>
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
  return (
    <div className="guide-content">
      <div className="guide-faq-list">
        {FAQS.map((faq) => (
          <details key={faq.q} className="guide-faq-item">
            <summary className="guide-faq-q">
              <span>{faq.q}</span>
              <Icon name="plus" size={16} className="guide-faq-chevron" />
            </summary>
            <div className="guide-faq-a">{faq.a}</div>
          </details>
        ))}
      </div>
      <p className="guide-disclaimer">
        Based on past CAP brochures. Always check the official CET Cell notices for the current year.
      </p>
    </div>
  );
}

function DecisionCard({ title, yes, no }: { title: string; yes: string; no: string }) {
  return (
    <div className="guide-decision">
      <h3 className="guide-decision-title">{title}</h3>
      <div className="guide-decision-row">
        <span className="sr-only">Yes:</span>
        <span className="guide-decision-check"><Icon name="check" size={16} /></span>
        <span>{yes}</span>
      </div>
      <div className="guide-decision-row">
        <span className="sr-only">No:</span>
        <span className="guide-decision-cross"><Icon name="close" size={16} /></span>
        <span>{no}</span>
      </div>
    </div>
  );
}
