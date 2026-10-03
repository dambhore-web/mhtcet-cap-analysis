import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, generalOpen, type MeritEstimate } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { formatNumber } from "../lib/format";
import { logBounds, logScale, tickLabel, ticksIn } from "../lib/logScale";
import { useWidth } from "../lib/useWidth";
import { usePageMeta } from "../lib/seo";
import "./EstimatePage.css";

/**
 * The estimated merit range as a band over every branch's latest-round open closing rank: dark
 * blue lines are within reach at either end, light blue ones depend on where in the range you land.
 */
function RangeBand({ lo, hi }: { lo: number; hi: number }) {
  const [vals, setVals] = useState<number[] | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  useEffect(() => {
    let live = true;
    api.openLatest().then((r) => live && setVals(generalOpen(r.rows).map((x) => x[4]))).catch(() => live && setVals([]));
    return () => {
      live = false;
    };
  }, []);
  if (vals && vals.length === 0) return null;
  const sure = (vals ?? []).filter((v) => hi <= v).length;
  const maybe = (vals ?? []).filter((v) => lo <= v && v < hi).length;
  const W = width || 600, H = 70;
  const dom = logBounds(vals ?? [lo, hi]);
  const x = logScale(dom, 4, W - 8);
  return (
    <div className="estimate-band">
      {vals && (
        <p className="estimate-band-text">
          <b>{formatNumber(sure)}</b> branches were within reach at either end of the range, and <b>{formatNumber(maybe)}</b> more depend on where you land
          (general open seats, latest round).
        </p>
      )}
      <div ref={ref}>
        {vals && width > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ height: H, width: "100%", display: "block" }} role="img" aria-label={`Your likely merit range ${formatNumber(lo)} to ${formatNumber(hi)} against every branch's closing rank`}>
            <rect x={4} y={10} width={W - 8} height={34} rx={4} className="eb-bg" />
            {vals.map((v, i) => <line key={i} x1={x(v)} x2={x(v)} y1={10} y2={44} className={hi <= v ? "eb-line sure" : lo <= v ? "eb-line maybe" : "eb-line"} />)}
            <rect x={x(lo)} y={4} width={Math.max(x(hi) - x(lo), 2)} height={46} rx={4} className="eb-range" />
            {ticksIn(dom, W < 520).map((t) => <text key={t} x={x(t)} y={62} textAnchor="middle" className="eb-axis">{tickLabel(t)}</text>)}
          </svg>
        )}
      </div>
    </div>
  );
}

type Mode = "cet" | "jee";
interface JeeEstimate { estimatedRank: number; rankRange: [number, number]; disclaimer: string; kind?: "all-india-merit" | "jee-rank"; }

/** Estimate a state merit number (from the MHT-CET percentile) or a JEE Main rank before the lists are out. */
export function EstimatePage() {
  usePageMeta({ title: "MHT-CET percentile to merit number estimate", description: "Estimate your state merit number range from your MHT-CET percentile, and see which branches that range reached in past CAP rounds." });
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
          <RangeBand lo={cet.estimatedMeritRange[0]} hi={cet.estimatedMeritRange[1]} />
          <div className="estimate-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/find?merit=${cet.estimatedMeritRange[1]}&est=1`)}>
              <Icon name="search" size={18} />
              Plan with {formatNumber(cet.estimatedMeritRange[1])} (the cautious end)
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(`/find?merit=${mid}&est=1`)}>
              Explore with {formatNumber(mid)}
            </button>
            <Link to="/profile/details" className="btn btn-ghost">Save it in My details</Link>
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
          CAP allots seats by merit number, so GetMeCollege uses it for every result.
        </p>
      </section>
    </div>
  );
}
