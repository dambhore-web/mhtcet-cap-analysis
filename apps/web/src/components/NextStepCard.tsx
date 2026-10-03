import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAllotment } from "../lib/allotment";
import { useList } from "../lib/list";
import { nextStep } from "../lib/nextStep";
import { useProgress } from "../lib/progress";
import { useProfile } from "../lib/ProfileContext";
import { Icon } from "./Icon";
import "./NextStepCard.css";

const DISMISS_KEY = "compass_next_step_dismissed";

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/**
 * "What should I do next?" (#135): one primary action for where the student is in CAP, from what
 * this browser already knows. Dismissing hides it for the session, until the step changes.
 */
export function NextStepCard({ hasScore = false }: { hasScore?: boolean } = {}) {
  const { profile } = useProfile();
  const items = useList();
  const allotment = useAllotment();
  const progress = useProgress();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(readDismissed);

  const step = nextStep({ merit: profile.meritNumber, hasScore, listSize: items.length, allotment, progress });
  if (dismissed === step.id) return null;

  const [path, hash] = step.to.split("#");
  const go = () => {
    // a step on this page (e.g. the results below): scroll to it instead of reloading the page
    if (path === pathname && hash) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else navigate(step.to);
  };
  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, step.id);
    } catch {
      /* private mode: hide for this page view only */
    }
    setDismissed(step.id);
  };

  return (
    <section className="next-step" aria-labelledby="next-step-title">
      <div className="next-step-body">
        <p className="next-step-eyebrow">
          <span className="next-step-label">Next step</span>
          <span aria-hidden="true">·</span>
          <span>{step.stage}</span>
        </p>
        <h2 id="next-step-title">{step.title}</h2>
        <p className="next-step-text">{step.text}</p>
      </div>
      <div className="next-step-actions">
        <button type="button" className="btn btn-primary" onClick={go}>
          {step.cta}
          <Icon name="arrowRight" size={16} />
        </button>
        {step.secondary && (
          <Link to={step.secondary.to} className="next-step-secondary">
            {step.secondary.label}
          </Link>
        )}
      </div>
      <button type="button" className="next-step-close" onClick={dismiss} aria-label="Hide the next step for now">
        <Icon name="close" size={16} />
      </button>
    </section>
  );
}
