import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import "./SignInPage.css";

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      await signIn();
      navigate(-1);
    } catch {
      setError("Google sign-in isn't available yet. Your details stay saved in this browser meanwhile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page page--narrow signin-page">
      <PageHeader
        breadcrumb={[{ label: "Account", to: "/profile" }, { label: "Sign in" }]}
        title="Sign in to Compass"
        subtitle="Keep your details and option form in sync across devices."
      />

      <div className="signin-body card">
        <button
          type="button"
          className="signin-google-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <GoogleIcon />
          {loading ? "Signing in…" : "Continue with Google"}
        </button>

        {error && <p className="signin-error" role="alert">{error}</p>}

        <div className="signin-coming-soon">
          <span className="badge badge-sample">Coming soon</span>
          <p>Accounts are not live yet. Until then, this browser keeps:</p>
          <ul className="signin-kept">
            <li><Icon name="check" size={14} />Your details (merit number, category, home university)</li>
            <li><Icon name="check" size={14} />Your option form, in order</li>
            <li><Icon name="check" size={14} />Colleges you're comparing</li>
          </ul>
        </div>

        <Link to="/" className="btn btn-ghost btn-block">
          Continue without signing in
          <Icon name="arrowRight" size={16} />
        </Link>

        <p className="signin-legal">
          By signing in you agree to our{" "}
          <Link to="/legal?tab=terms" className="signin-legal-link">Terms</Link>
          {" "}and{" "}
          <Link to="/legal?tab=privacy" className="signin-legal-link">Privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2a10.3 10.3 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91A8.78 8.78 0 0 0 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A8.99 8.99 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z" fill="#FBBC05"/>
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A8.95 8.95 0 0 0 9 0 8.99 8.99 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
