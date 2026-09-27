import "./ListPage.css";

export function ListPage() {
  return (
    <div className="list-page">
      <header className="list-header">
        <h1>My List</h1>
        <p>Build and export your CAP preference list.</p>
      </header>
      <div className="list-placeholder">
        <div className="placeholder-icon">📋</div>
        <h2>Coming soon</h2>
        <p>
          The preference-list builder is in development. You'll be able to drag-and-reorder up to 300 options and export as PDF or Excel — free.
        </p>
        <span className="placeholder-issue"># issue 37</span>
      </div>
    </div>
  );
}
