import "./AskPage.css";

const SAMPLE_QUESTIONS = [
  "What is the difference between Freeze, Float, and Slide?",
  "What documents do I need at the CAP reporting centre?",
  "Can I change my preferences after Round I allotment?",
  "What happens if I don't report to the allotment centre?",
  "What is TFWS and how do I qualify?",
  "How is the home university quota different from state quota?",
];

export function AskPage() {
  return (
    <div className="ask-page">
      <header className="ask-header">
        <div className="ask-header-icon">✦</div>
        <div>
          <h1>Ask</h1>
          <p>AI-powered admissions assistant — coming soon</p>
        </div>
      </header>

      <div className="ask-body">
        <div className="ask-preview-card">
          <div className="ask-preview-title">What can you ask?</div>
          <ul className="ask-sample-list">
            {SAMPLE_QUESTIONS.map((q) => (
              <li key={q} className="ask-sample-item">
                <span className="ask-sample-q">Q</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ask-coming-soon">
          <p>
            The AI assistant is being trained on official CET Cell documents, DTE rulings, and past CAP notifications. It will cite sources for every answer.
          </p>
          <div className="ask-notify-row">
            <span className="ask-timeline-badge">Expected: Oct 2026</span>
          </div>
        </div>

        <div className="ask-mock-input">
          <span className="ask-mock-placeholder">Ask a question about MHT-CET admissions…</span>
          <span className="ask-mock-send">↑</span>
        </div>
      </div>
    </div>
  );
}
