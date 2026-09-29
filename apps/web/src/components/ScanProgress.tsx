import { useEffect, useMemo, useRef, useState } from "react";
import { api, type DataMeta } from "../lib/api";
import { SCAN_MIN_MS, scanStages, stagesDone, type ScanRequest } from "../lib/scan";
import { Icon } from "./Icon";
import "./ScanProgress.css";

const reducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * "Checking the CAP lists for you" (#142): shown while the first search after onboarding runs.
 * Stays up about 3 s (none with reduced motion) and calls onFinish once the search is back.
 */
export function ScanProgress({ request, searchDone, pills, onFinish }: {
  request: ScanRequest;
  searchDone: boolean;
  pills: string[];
  onFinish: () => void;
}) {
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const minMs = useMemo(() => (reducedMotion() ? 0 : SCAN_MIN_MS), []);
  const finished = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    let live = true;
    api.meta().then((m) => live && setMeta(m)).catch(() => undefined);
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 150);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  const stages = scanStages(meta, request);
  const done = stagesDone(stages.length, elapsed, searchDone, minMs);
  const pct = Math.round((done / stages.length) * 100);

  useEffect(() => {
    if (done === stages.length && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [done, stages.length, onFinish]);

  return (
    <section className="scan page" aria-labelledby="scan-title">
      <div className="scan-card">
        <h1 id="scan-title" ref={headingRef} tabIndex={-1}>Checking the CAP lists for you</h1>
        <ul className="scan-pills" aria-label="Your answers">
          {pills.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <div className="scan-bar" role="progressbar" aria-label="Search progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="scan-count">
          <span>{done} of {stages.length} checks</span>
          <span>{pct}%</span>
        </div>
        <ol className="scan-stages">
          {stages.map((s, i) => {
            const state = i < done ? "done" : i === done ? "now" : "todo";
            return (
              <li key={s.title} className={`scan-stage scan-stage--${state}`}>
                <span className="scan-ic" aria-hidden="true">{state === "done" && <Icon name="check" size={14} />}</span>
                <span>
                  <strong>{s.title}</strong> {s.detail}
                  <span className="sr-only">{state === "done" ? " (done)" : state === "now" ? " (in progress)" : ""}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="scan-note" aria-live="polite">
          {done < stages.length ? `Now: ${stages[Math.min(done, stages.length - 1)].title.replace(/:$/, "")}` : "Done"}
        </p>
        <p className="scan-foot">Based on last year's official lists. A guide, not a guarantee of admission.</p>
      </div>
    </section>
  );
}
