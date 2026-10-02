import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Icon } from "./Icon";
import { PAYMENTS_ENABLED } from "../lib/plans";
import "./AccountPanel.css";

const SYNC_TEXT = { syncing: "Saving to your account…", synced: "Saved to your account", error: "Couldn't reach your account. Changes are kept here and saved when you're back online." } as const;

/** My details: sign in, or the signed-in account with its sync state, sign out and delete (#15). */
export function AccountPanel() {
  const { user, configured, syncStatus, signOut, deleteAccountData } = useAuth();
  const { pathname } = useLocation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="profile-account-row">
        <Link to="/signin" state={{ from: pathname }} className="btn btn-secondary btn-sm">
          <Icon name="user" size={16} />
          {configured ? "Sign in to use on other devices" : "Sign in (coming soon)"}
        </Link>
        {PAYMENTS_ENABLED && (
          <Link to="/plans" className="btn btn-ghost btn-sm">
            See plans
            <Icon name="arrowRight" size={16} />
          </Link>
        )}
      </div>
    );
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteAccountData();
    } catch {
      setError("Couldn't delete the saved data. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <section className="card account-panel" aria-labelledby="account-title">
      <div className="account-head">
        <div>
          <h2 id="account-title">Your account</h2>
          <p className="account-who">{user.name ? <><b>{user.name}</b> · </> : null}{user.email}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void signOut()}>Sign out</button>
      </div>
      {syncStatus && (
        <p className={`account-sync account-sync--${syncStatus}`} role="status">
          <Icon name={syncStatus === "error" ? "alert" : syncStatus === "synced" ? "check" : "clock"} size={14} />
          {SYNC_TEXT[syncStatus]}
        </p>
      )}
      <p className="account-note">
        Your details, option form, compare list and CAP progress follow you to any device you sign in on.
        Signing out removes them from this browser; they stay in your account.
      </p>
      {confirming ? (
        <div className="account-delete" role="group" aria-label="Delete saved data">
          <p>This deletes everything saved to your account and signs you out. This browser keeps its copy.</p>
          <div className="account-delete-actions">
            <button type="button" className="btn btn-sm account-delete-btn" onClick={() => void remove()} disabled={busy}>
              {busy ? "Deleting…" : "Yes, delete my saved data"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={busy}>Keep it</button>
          </div>
          {error && <p className="account-error" role="alert">{error}</p>}
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm account-delete-open" onClick={() => setConfirming(true)}>
          Delete data saved to my account
        </button>
      )}
    </section>
  );
}
