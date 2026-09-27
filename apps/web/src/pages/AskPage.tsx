import "./AskPage.css";

export function AskPage() {
  return (
    <div className="ask-page">
      <header className="ask-header">
        <h1>Ask</h1>
        <p>AI-powered admissions assistant.</p>
      </header>
      <div className="ask-placeholder">
        <div className="placeholder-icon">✦</div>
        <h2>Coming soon</h2>
        <p>
          Ask anything about MHT-CET CAP — cutoffs, eligibility, Freeze vs Float, TFWS rules. The assistant will cite official sources.
        </p>
        <span className="placeholder-issue"># issue 18</span>
      </div>
    </div>
  );
}
