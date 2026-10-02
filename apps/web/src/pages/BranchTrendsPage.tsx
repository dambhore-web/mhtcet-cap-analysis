import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { AddToFormButton } from "../components/AddToFormButton";
import { MeritRuler } from "../components/MeritRuler";
import { YearDumbbells, SeatTrails, YearTable } from "../components/YearTrend";
import { listItemFrom } from "../lib/list";
import { formatNumber, formatRound, roundIndex } from "../lib/format";
import { roundMerit } from "../lib/logScale";
import { seatTypeLabel, seatTypeSortKey } from "../lib/seatType";
import { trendVerdict, yearSeries, yearsWithin, type HistoryRow, type RoundMode } from "../lib/yearTrend";
import { branchMeta, usePageMeta } from "../lib/seo";
import "./BranchTrendsPage.css";

interface Row {
  choiceCode: string;
  branch: string;
  list: string;
  round: string;
  seatType: string;
  closingMerit: number;
}

type Status = "loading" | "done" | "error";

/** Journey J4 step 3 (#85): how one branch's closing ranks moved, per seat type and year. */
export function BranchTrendsPage() {
  const { code = "", choiceCode = "" } = useParams();
  const { profile } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [college, setCollege] = useState<{ code: string; name: string } | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [seat, setSeat] = useState<string | null>(null);
  const [mode, setMode] = useState<RoundMode>("first");
  const [merit, setMerit] = useState<number | null>(profile.meritNumber);
  const [meritText, setMeritText] = useState(profile.meritNumber ? formatNumber(profile.meritNumber) : "");

  useEffect(() => {
    setStatus("loading");
    api
      .collegeCutoffs(code)
      .then((d) => {
        setCollege(d.college);
        setYear(d.year);
        setRows((d.cutoffs as Row[]).filter((r) => r.list !== "AI"));
        setStatus("done");
      })
      .catch(() => setStatus("error"));
    // Earlier years are optional: the page still works if the history call fails.
    setHistory(null);
    setSeat(null);
    api.branchHistory(choiceCode).then((h) => setHistory(h.rows)).catch(() => setHistory([]));
  }, [code, choiceCode]);

  const branchRows = useMemo(() => rows.filter((r) => r.choiceCode === choiceCode), [rows, choiceCode]);
  const branch = branchRows[0]?.branch ?? "Branch";
  const dataYears = useMemo(() => [...new Set((history ?? []).map((r) => r.year))], [history]);
  usePageMeta(
    status === "error" || (status === "done" && branchRows.length === 0)
      ? { title: "Branch not found", noindex: true }
      : college && branchRows.length > 0
        ? branchMeta(college.name, branch, dataYears.length ? dataYears : year ? [year] : [])
        : null,
  );
  const seatTypes = useMemo(
    () => [...new Set((history ?? []).map((r) => r.seatType))].sort((a, b) => seatTypeSortKey(a) - seatTypeSortKey(b)),
    [history],
  );

  // Default seat type: the student's own general seat if this branch has it, else general open.
  useEffect(() => {
    if (seat || seatTypes.length === 0) return;
    const own = profile.category ? `G${profile.category}S` : null;
    setSeat(own && seatTypes.includes(own) ? own : seatTypes.includes("GOPENS") ? "GOPENS" : seatTypes[0]);
  }, [seatTypes, seat, profile.category]);

  // Without a saved merit number, start the pin in the middle of this seat type's Round I cutoffs.
  useEffect(() => {
    if (merit != null || !history || !seat) return;
    const r1 = yearSeries(history, seat, "first").map((p) => p.closingMerit).sort((a, b) => a - b);
    if (r1.length) {
      const m = roundMerit(r1[Math.floor(r1.length / 2)]);
      setMerit(m);
      setMeritText(formatNumber(m));
    }
  }, [history, seat, merit]);

  const points = useMemo(() => (history && seat ? yearSeries(history, seat, mode) : []), [history, seat, mode]);
  const within = merit != null ? yearsWithin(points, merit) : [];
  const verdict = trendVerdict(points);
  const roundText = mode === "first" ? formatRound(1) : "the last round";

  const gopens = useMemo(() => {
    const rs = branchRows.filter((r) => r.seatType === "GOPENS").sort((a, b) => roundIndex(a.round) - roundIndex(b.round));
    if (!rs.length) return null;
    return { first: rs.find((r) => roundIndex(r.round) === 1)?.closingMerit ?? null, last: rs[rs.length - 1].closingMerit };
  }, [branchRows]);

  // Other branches at this college, by their latest general open closing rank
  const others = useMemo(() => {
    const by = new Map<string, { branch: string; last: number; round: number }>();
    for (const r of rows) {
      if (r.choiceCode === choiceCode || r.seatType !== "GOPENS") continue;
      const prev = by.get(r.choiceCode);
      if (!prev || roundIndex(r.round) > prev.round) by.set(r.choiceCode, { branch: r.branch, last: r.closingMerit, round: roundIndex(r.round) });
    }
    return [...by.entries()].sort(([, a], [, b]) => a.last - b.last);
  }, [rows, choiceCode]);

  const crumbs = [
    { label: "Colleges", to: "/colleges" },
    { label: college?.name ?? "College", to: `/colleges/${code}` },
    { label: branch },
  ];

  if (status === "error" || (status === "done" && branchRows.length === 0)) {
    return (
      <div className="page trends-page">
        <PageHeader title="Branch not found" breadcrumb={crumbs} />
        <div className="empty-state"><p>We have no closing ranks for this choice code.</p><Link to={`/colleges/${code}`} className="btn btn-secondary">Back to the college</Link></div>
      </div>
    );
  }

  const commitMerit = (text: string) => {
    const v = parseInt(text.replace(/\D/g, ""), 10);
    if (v > 0) {
      setMerit(v);
      setMeritText(formatNumber(v));
    } else setMeritText(merit ? formatNumber(merit) : "");
  };
  const moveMerit = (v: number) => {
    setMerit(v);
    setMeritText(formatNumber(v));
  };

  return (
    <div className="page trends-page">
      <PageHeader
        breadcrumb={crumbs}
        title={
          status === "loading" ? "Loading…" : (
            <>
              {branch}
              <span className="trends-college">{college?.name}</span>
            </>
          )
        }
        subtitle={<>Choice code <span className="mono">{choiceCode}</span> · CAP {history && history.length ? `${Math.min(...history.map((r) => r.year))}–${String(Math.max(...history.map((r) => r.year))).slice(2)}` : year}, state-level lists</>}
        actions={
          gopens && college ? (
            <AddToFormButton
              variant="button"
              item={listItemFrom({ choiceCode, collegeCode: code, collegeName: college.name, branch, seatType: "GOPENS", closingMerit: gopens.last, year: year ?? 0, firstRoundClosing: gopens.first, lastRoundClosing: gopens.last })}
            />
          ) : null
        }
      />

      {history && history.length > 0 && seat ? (
        <>
          <section className="card trends-focus" aria-label="Four years for one seat type">
            <div className="trends-controls">
              <label className="trends-field">
                <span className="label">Your state merit number</span>
                <input
                  className="trends-merit"
                  inputMode="numeric"
                  value={meritText}
                  onChange={(e) => setMeritText(e.target.value)}
                  onBlur={(e) => commitMerit(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitMerit((e.target as HTMLInputElement).value)}
                  aria-describedby="trends-verdict"
                />
              </label>
              <label className="trends-field">
                <span className="label">Seat type</span>
                <select value={seat} onChange={(e) => setSeat(e.target.value)}>
                  {seatTypes.map((st) => <option key={st} value={st}>{seatTypeLabel(st)}</option>)}
                </select>
              </label>
              <div className="trends-field">
                <span className="label">Round</span>
                <div className="trends-seg" role="group" aria-label="Round">
                  <button type="button" aria-pressed={mode === "first"} onClick={() => setMode("first")}>{formatRound(1)}</button>
                  <button type="button" aria-pressed={mode === "last"} onClick={() => setMode("last")}>Last round</button>
                </div>
              </div>
            </div>
            <div className="trends-verdict-wrap">
              <p className="trends-verdict" id="trends-verdict" aria-live="polite">
                {merit != null ? <>At <span className="tnum">{formatNumber(merit)}</span>, you'd have got in <b>{within.length} of {points.length}</b> years.</> : "Put in your merit number to see which years you'd have got in."}
              </p>
              {verdict && (
                <p className="trends-verdict-sub">
                  {seatTypeLabel(seat)}, {roundText}: closed at {formatNumber(verdict.from.closingMerit)} in {verdict.from.year} and {formatNumber(verdict.to.closingMerit)} in {verdict.to.year}
                  {verdict.direction === "steady" ? ", about the same." : verdict.direction === "harder" ? ", harder now." : ", easier now."}
                </p>
              )}
              <MeritRuler
                marks={points.map((p) => ({ value: p.closingMerit, label: String(p.year) }))}
                merit={merit}
                onMeritChange={moveMerit}
                ariaLabel={`${seatTypeLabel(seat)} closing rank in each year, with your merit number`}
                hint="Each tick is one year's closing rank"
              />
            </div>
          </section>

          <div className="trends-split">
            <div className="trends-main">
              <section className="card trends-card" aria-labelledby="trends-year-title">
                <h2 id="trends-year-title">Closing rank by year</h2>
                <p className="trends-desc">{seatTypeLabel(seat)}. One dumbbell per year, from {formatRound(1)} to the final round. Higher on the chart is harder to get.</p>
                <div className="trends-legend">
                  <span><i className="dot-r1" />{formatRound(1)}</span>
                  <span><i className="dot-last" />Final round</span>
                  {merit != null && <span><i className="dash" />Your merit</span>}
                </div>
                <YearDumbbells rows={history} seatType={seat} merit={merit} />
              </section>

              <section className="card trends-card" aria-labelledby="trends-seats-title">
                <h2 id="trends-seats-title">Every seat type, {points.length > 1 ? `${new Set(history.map((r) => r.year)).size} years` : "by year"}</h2>
                <p className="trends-desc">Each row is a seat type ({roundText}). Dots run from the oldest year (pale) to the newest (dark). Further left is harder. Pick a row to show it above.</p>
                <SeatTrails rows={history} mode={mode} selected={seat} merit={merit} onSelect={(st) => { setSeat(st); window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }} />
                <YearTable rows={history} mode={mode} />
              </section>
            </div>

            <aside className="trends-side">
              <section className="card trends-card">
                <h2>Your chances, by year</h2>
                {merit != null ? (
                  <dl className="trends-years">
                    {[...new Set(history.map((r) => r.year))].sort().map((yr) => {
                      const p = points.find((q) => q.year === yr);
                      return (
                        <div key={yr}>
                          <dt>{yr}</dt>
                          <dd>
                            {!p ? <span className="trends-none">no seats</span> : merit <= p.closingMerit ? <span className="badge badge-safe">✓ In</span> : <span className="badge badge-out">– Out</span>}
                            {p && <span className="mono trends-cut">{formatNumber(p.closingMerit)}</span>}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                ) : (
                  <p className="trends-desc">Add your merit number above.</p>
                )}
                <p className="trends-desc">{seatTypeLabel(seat)}, {roundText}. A closing rank that swings a lot between years usually means a small seat pool.</p>
              </section>
              {others.length > 0 && (
                <section className="card trends-card">
                  <h2>Other branches here</h2>
                  <ul className="trends-others">
                    {others.map(([cc, o]) => (
                      <li key={cc}>
                        <Link to={`/colleges/${code}/${cc}`}><span>{o.branch}</span><span className="mono">{formatNumber(o.last)}</span></Link>
                      </li>
                    ))}
                  </ul>
                  <p className="trends-desc">General open, latest round.</p>
                </section>
              )}
            </aside>
          </div>
        </>
      ) : history === null ? (
        <div className="card trends-skeleton" aria-busy="true" />
      ) : (
        <section className="card trends-card">
          <h2>Closing rank by year</h2>
          <p className="trends-desc">Earlier years aren't loaded for this branch, so there's no year-on-year trend yet.</p>
        </section>
      )}

      <p className="trends-foot">Vacancies after each round aren't shown. <Link to="/data">What's loaded</Link></p>
    </div>
  );
}
