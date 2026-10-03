import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Render nothing on error instead of the full fallback (for non-essential widgets). */
  silent?: boolean;
  /** Changing this value clears the error (e.g. the current route). */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

const STORAGE_KEYS = ["compass_profile_v1", "compass_list_v1", "compass_compare_v1", "compass_session_v1", "compass_progress_v1"];

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GetMeCollege UI error", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  private resetSavedData = () => {
    for (const k of STORAGE_KEYS) {
      try { localStorage.removeItem(k); } catch { /* storage unavailable */ }
    }
    window.location.assign("/");
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.silent) return null;
    return (
      <div className="page page--narrow">
        <div className="empty-state" role="alert" style={{ marginTop: 32 }}>
          <h2>Something went wrong on this page</h2>
          <p>Try going back to the home page. If it keeps happening, your saved data on this device may be out of date; resetting it clears your saved details, list and comparison.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn-primary" href="/">Go to home</a>
            <button type="button" className="btn btn-secondary" onClick={this.resetSavedData}>Reset saved data</button>
          </div>
        </div>
      </div>
    );
  }
}
