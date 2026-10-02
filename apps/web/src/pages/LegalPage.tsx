import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import "./LegalPage.css";

type Tab = "disclaimer" | "privacy" | "terms";

const TABS: [Tab, string][] = [
  ["disclaimer", "Disclaimer"],
  ["privacy", "Privacy"],
  ["terms", "Terms"],
];

export function LegalPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = raw === "privacy" || raw === "terms" ? raw : "disclaimer";
  const setTab = (t: Tab) => setParams(t === "disclaimer" ? {} : { tab: t }, { replace: true });

  return (
    <div className="page page--narrow legal-page">
      <PageHeader title="Disclaimer, privacy and terms" />

      <div className="legal-tabs" role="tablist" aria-label="Legal documents">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`legal-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="legal-panel"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="legal-body card" role="tabpanel" id="legal-panel" aria-labelledby={`legal-tab-${tab}`}>
        {tab === "disclaimer" && <DisclaimerTab />}
        {tab === "privacy" && <PrivacyTab />}
        {tab === "terms" && <TermsTab />}
      </div>
    </div>
  );
}

function DisclaimerTab() {
  return (
    <div className="legal-content">
      <h2>Disclaimer</h2>
      <p className="legal-updated">Last updated: September 2026</p>
      <div className="legal-tldr">
        <strong>In short</strong>
        <ul>
          <li>Compass is unofficial and not linked to the CET Cell or DTE.</li>
          <li>Cutoffs are from past rounds. They guide you; they don't guarantee a seat.</li>
          <li>Your details and option form are saved in your browser.</li>
        </ul>
      </div>

      <h3>Unofficial product</h3>
      <p>
        Compass is an independent information tool. It is <strong>not affiliated with, endorsed by, or operated by</strong> the Maharashtra State Common Entrance Test Cell (CET Cell), the Directorate of Technical Education (DTE), the Government of Maharashtra, or any university listed on this platform.
      </p>

      <h3>Past data — not a guarantee</h3>
      <p>
        All cutoff data shown on Compass is sourced from official DTE Maharashtra / CET Cell publications for the 2026 academic year. This data reflects <strong>past admission rounds only</strong> and does not predict, guarantee, or imply any future outcome. Actual cutoffs in upcoming CAP rounds may differ significantly due to changes in the merit list, seat availability, policy changes, or other factors.
      </p>

      <h3>Use at your own discretion</h3>
      <p>
        Compass is intended to help students and families <strong>understand their options and plan their strategy</strong>. It is not a substitute for official DTE communications, allotment letters, or counselling from a qualified educational advisor. Always verify admission details at <a href="https://cetcell.mahacet.org" className="legal-link" target="_blank" rel="noopener noreferrer">cetcell.mahacet.org</a> before taking any action.
      </p>

      <h3>Accuracy and completeness</h3>
      <p>
        While we strive to publish accurate, complete data, Compass cannot guarantee that the information is free from errors, omissions, or delays. If you find a discrepancy, please report it to us.
      </p>

      <h3>Fee data</h3>
      <p>
        Annual fee figures shown are based on Fee Regulating Authority (FRA) orders and are indicative. Actual fees charged by individual institutions may vary. Confirm fees directly with the college.
      </p>

      <div className="legal-source-box">
        <strong>Official source:</strong>{" "}
        <a href="https://cetcell.mahacet.org" className="legal-link" target="_blank" rel="noopener noreferrer">
          cetcell.mahacet.org
        </a>
      </div>
    </div>
  );
}

function PrivacyTab() {
  return (
    <div className="legal-content">
      <h2>Privacy Policy</h2>
      <p className="legal-updated">Last updated: October 2026 · Effective: October 2026</p>

      <p>
        This Privacy Policy describes how Compass ("we", "our", "the app") collects, uses, and protects information when you use the Compass web application. By using Compass, you agree to the practices described here.
      </p>

      <h3>1. Information we collect</h3>
      <h4>Information you provide</h4>
      <ul>
        <li><strong>Student profile:</strong> Merit number, category, gender, subject group, home university, and special category flags (EWS, TFWS, Defence, PWD, Orphan). This is stored locally in your browser (localStorage) and never sent to our servers unless you explicitly sign in.</li>
        <li><strong>Preference list:</strong> The colleges and branches you save are stored locally in your browser.</li>
        <li><strong>If you sign in with Google:</strong> your name and email address from Google, and a copy of your student profile, option form, compare list, allotment and CAP progress, so they follow you to other devices. These are stored in our database, hosted by Supabase, where only your signed-in account can read them. We do not receive your Google password.</li>
      </ul>

      <h4>Information collected automatically</h4>
      <ul>
        <li><strong>Search queries:</strong> Your rank-finder searches (merit number, category, filters) are sent to our API server to compute results. We do not currently log or store these queries beyond the current request.</li>
        <li><strong>Standard server logs:</strong> IP address, browser type, and request metadata are logged temporarily for security and operational purposes.</li>
      </ul>

      <h3>2. How we use information</h3>
      <ul>
        <li>To provide rank-finder results, college information, and fee data</li>
        <li>To maintain and improve the service</li>
        <li>To investigate security incidents</li>
      </ul>
      <p>We do <strong>not</strong> sell your data, use it for advertising, or share it with third parties except as required by law.</p>

      <h3>3. Data storage and retention</h3>
      <p>
        Profile and preference data is stored in your browser's localStorage. You can clear this at any time by clearing your browser data or using "Clear saved details" in My details. If you sign in, the copy saved to your account is kept until you delete it with "Delete data saved to my account" in My details; signing out removes it from that browser. Server logs are retained for up to 30 days.
      </p>

      <h3>4. Digital Personal Data Protection Act (DPDP) 2023</h3>
      <p>
        We are committed to compliance with the Digital Personal Data Protection Act 2023 (India). As a product primarily serving students in India, we process personal data only to the extent necessary to provide the service. You have the right to access, correct, or request deletion of your data. Contact us at the email below to exercise these rights.
      </p>

      <h3>5. Cookies</h3>
      <p>
        Compass does not use tracking cookies. We use browser localStorage for application state, and, if you sign in, to keep you signed in.
      </p>

      <h3>6. Children's privacy</h3>
      <p>
        Compass is intended for students who are 17 years of age or older (as MHT-CET candidates). If you believe a minor under 13 has submitted data, contact us for removal.
      </p>

      <h3>7. Contact</h3>
      <p>
        For privacy-related queries or to exercise your DPDP rights, contact:{" "}
        <a href="mailto:support@compass.app" className="legal-link">support@compass.app</a>
      </p>
    </div>
  );
}

function TermsTab() {
  return (
    <div className="legal-content">
      <h2>Terms of Service</h2>
      <p className="legal-updated">Last updated: September 2026 · Effective: September 2026</p>

      <p>
        These Terms of Service ("Terms") govern your use of the Compass web application. By accessing or using Compass, you agree to these Terms.
      </p>

      <h3>1. Service description</h3>
      <p>
        Compass is an information tool that helps MHT-CET candidates explore engineering college admission cutoffs based on official 2026 data. The free tier is available to all users. A paid plan (Compass Pro) provides additional features including the AI admission assistant, CAP round simulator, and priority support.
      </p>

      <h3>2. Acceptable use</h3>
      <ul>
        <li>You must be 13 years of age or older to use Compass.</li>
        <li>You may not use Compass to scrape, bulk-download, or re-distribute cutoff data commercially.</li>
        <li>You may not attempt to access, modify, or disrupt the API, database, or infrastructure.</li>
        <li>You may not impersonate DTE, CET Cell, or any institution on this platform.</li>
      </ul>

      <h3>3. Paid plans and refund policy</h3>
      <p>
        Paid subscriptions are billed monthly or annually. Payments are processed via Razorpay. All amounts are in INR and inclusive of applicable GST.
      </p>
      <p>
        <strong>Refund policy:</strong> You may request a full refund within <strong>7 days</strong> of purchase if you have not used the paid features. After 7 days, or after using the AI assistant or simulator, refunds are at our discretion. To request a refund, email <a href="mailto:support@compass.app" className="legal-link">support@compass.app</a> with your order reference.
      </p>

      <h3>4. GST and invoicing</h3>
      <p>
        Compass is operated by [Business Entity Name], GSTIN: [GSTIN]. A GST-compliant invoice is issued automatically for every paid transaction.
      </p>

      <h3>5. Intellectual property</h3>
      <p>
        The Compass interface, brand, and code are proprietary. Cutoff data is sourced from official DTE Maharashtra publications and is reproduced here under fair use for educational purposes.
      </p>

      <h3>6. Limitation of liability</h3>
      <p>
        Compass is provided "as is" without warranty of any kind. To the fullest extent permitted by law, we are not liable for decisions made based on information shown on this platform, including but not limited to college choices, admission outcomes, or financial decisions.
      </p>

      <h3>7. Changes to terms</h3>
      <p>
        We may update these Terms. Material changes will be notified in-app at least 7 days before taking effect. Continued use after the effective date constitutes acceptance.
      </p>

      <h3>8. Governing law</h3>
      <p>
        These Terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of courts in Pune, Maharashtra.
      </p>

      <h3>9. Contact</h3>
      <p>
        <a href="mailto:support@compass.app" className="legal-link">support@compass.app</a>
      </p>
    </div>
  );
}
