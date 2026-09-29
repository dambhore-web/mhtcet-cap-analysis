import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type MeritEstimate } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { formatNumber } from "../lib/format";
import "./EstimatePage.css";

type Mode = "cet" | "jee";
interface JeeEstimate { estimatedRank: number; rankRange: [number, number]; disclaimer: string; kind?: "all-india-merit" | "jee-rank"; }

/** Estimate a state merit number (from the MHT-CET percentile) or a JEE Main rank before the lists are out. */
export function EstimatePage() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("cet");
  const [percentile, setPercentile] = useState("");
  const [subjectGroup, setSubjectGroup] = useState<"PCM" | "PCB">(profile.subjectGroup);
  const [cet, setCet] = useState<MeritEstimate | null>(null);
  const [jee, setJee] = useState<JeeEstimate | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pct = parseFloat(percentile);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      setError("Enter a percentile between 0 and 100, for example 92.84.");
      return;
    }
    setError("");
    setLoading(true);
    setCet(null);
    setJee(null);
    try {
      if (mode === "cet") setCet(await api.meritEstimate(pct, subjectGroup));
      else setJee(await api.jeeEstimate(pct));
    } catch {
      setError("Couldn't get an estimate right now. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setCet(null);
    setJee(null);
    setError("");
  }

  const mid = cet ? Math.round((cet.estimatedMeritRange[0] + cet.estimatedMeritRange[1]) / 2) : null;

  return (
    <div className="page page--narrow estimate-page">
      <PageHeader
        breadcrumb={[{ label: "Find colleges", to: "/find" }, { label: "Estimate merit number" }]}
        title="Estimate your merit number"
        subtitle="Merit list not published yet? Get a likely range from your percentile, then use it to explore colleges."
      />

      <form className="estimate-card card" onSubmit={handleSubmit} noValidate>
        <div className="estimate-toggle" role="group" aria-label="Which exam?">
          <button type="button" className={mode === "cet" ? "active" : ""} aria-pressed={mode === "cet"} onClick={() => switchMode("cet")}>
            MHT-CET percentile
          </button>
          <button type="button" className={mode === "jee" ? "active" : ""} aria-pressed={mode === "jee"} onClick={() => switchMode("jee")}>
            JEE Main percentile
          </button>
        </div>

        <div className="estimate-fields">
          <div className="estimate-field">
            <label htmlFor="est-pct" className="label">{mode === "cet" ? "MHT-CET percentile" : "JEE Main percentile"}</label>
            <input
              id="est-pct"
              className="estimate-input"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 92.84"
              value={percentile}
              onChange={(e) => { setPercentile(e.target.value); setError(""); }}
              aria-invalid={!!error}
              aria-describedby={error ? "est-error" : undefined}
              autoComplete="off"
            />
          </div>
          {mode === "cet" && (
            <div className="estimate-field">
              <label htmlFor="est-subj" className="label">Subject group</label>
              <select id="est-subj" className="estimate-input" value={subjectGroup} onChange={(e) => setSubjectGroup(e.target.value as "PCM" | "PCB")}>
                <option value="PCM">PCM</option>
                <option value="PCB">PCB</option>
              </select>
            </div>
          )}
        </div>

        {error && (
          <p id="est-error" className="estimate-error" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Estimating…" : "Estimate"}
        </button>
      </form>

      {cet && mid !== null && (
        <section className="estimate-result card" aria-live="polite" aria-labelledby="est-result-title">
          <h2 id="est-result-title" className="label">Likely state merit number</h2>
          <p className="estimate-range">
            {formatNumber(cet.estimatedMeritRange[0])} – {formatNumber(cet.estimatedMeritRange[1])}
          </p>
          <p className="estimate-note">
            {cet.method === "data"
              ? `Based on ${cet.sampleSize ? formatNumber(cet.sampleSize) + " " : ""}published results for ${cet.year}.`
              : "A statistical estimate: treat it as a rough guide."}{" "}
            {cet.disclaimer}
          </p>
          <div className="estimate-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/find?merit=${mid}&est=1`)}>
              <Icon name="search" size={18} />
              Find options for {formatNumber(mid)}
            </button>
            <Link to="/profile" className="btn btn-ghost">Save it in My details</Link>
          </div>
        </section>
      )}

      {jee && (
        <section className="estimate-result card" aria-live="polite" aria-labelledby="est-jee-title">
          <h2 id="est-jee-title" className="label">{jee.kind === "all-india-merit" ? "Likely All India merit number" : "Rough JEE Main rank"}</h2>
          <p className="estimate-range">
            {formatNumber(jee.rankRange[0])} – {formatNumber(jee.rankRange[1])}
          </p>
          <p className="estimate-note">{jee.disclaimer}</p>
          {jee.kind === "all-india-merit" && (
            <div className="estimate-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/find?merit=${jee.estimatedRank}&list=AI&est=1`)}>
                <Icon name="search" size={18} />
                Find All India seats for {formatNumber(jee.estimatedRank)}
              </button>
            </div>
          )}
        </section>
      )}

      <section className="page-section estimate-explain">
        <h2>Percentile or merit number?</h2>
        <p>
          Your <strong>percentile</strong> compares you with everyone who took the exam in your session. Your{" "}
          <strong>state merit number</strong> is your rank in the CAP merit list, which CET Cell publishes after registration.
          CAP allots seats by merit number, so Compass uses it for every result.
        </p>
      </section>
    </div>
  );
}
