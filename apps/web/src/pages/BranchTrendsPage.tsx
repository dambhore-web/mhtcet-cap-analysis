import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { AddToFormButton } from "../components/AddToFormButton";
import { MeritLadder, LadderAxis, LadderLegend, ladderDomain } from "../components/MeritLadder";
import { listItemFrom } from "../lib/list";
import { formatNumber, formatRound, roundIndex } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel, seatTypeSortKey } from "../lib/seatType";
import "./BranchTrendsPage.css";

interface Row {
  choiceCode: string;
  branch: string;
  list: string;
  round: string;
  seatType: string;
  closingMerit: number;
  source?: string | null;
  sourcePage?: number | null;
}

type Status = "loading" | "done" | "error";

/** Journey J4 step 3 (#85): how one branch's closing ranks moved, per seat type. */
export function BranchTrendsPage() {
  const { code = "", choiceCode = "" } = useParams();
  const { profile } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [college, setCollege] = useState<{ code: string; name: string } | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const merit = profile.meritNumber;

  useEffect(() => {
    setStatus("loading");
    api
      .collegeCutoffs(code)
      .then((d) => {
        setCollege(d.college);
        setYear(d.year);
        setRows((d.cutoffs as Row[]).filter((r) => r.choiceCode === choiceCode && r.list !== "AI"));
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  }, [code, choiceCode]);

  const branch = rows[0]?.branch ?? "Branch";
  const seats = useMemo(() => {
    const by = new Map<string, Row[]>();
    for (const r of rows) by.set(r.seatType, [...(by.get(r.seatType) ?? []), r]);
    return [...by.entries()]
      .sort(([a], [b]) => seatTypeSortKey(a) - seatTypeSortKey(b))
      .map(([seatType, rs]) => {
        const sorted = [...rs].sort((a, b) => roundIndex(a.round) - roundIndex(b.round));
        const first = sorted.find((r) => roundIndex(r.round) === 1)?.closingMerit ?? null;
        const last = sorted[sorted.length - 1].closingMerit;
        return { seatType, rows: sorted, first, last };
      });
  }, [rows]);
  const rounds = useMemo(() => [...new Set(rows.map((r) => r.round))].sort((a, b) => roundIndex(a) - roundIndex(b)), [rows]);
  const domain = ladderDomain(seats.flatMap((s) => [s.first ?? s.last, s.last]).concat(merit ? [merit] : []));
  const gopens = seats.find((s) => s.seatType === "GOPENS");

  const crumbs = [
    { label: "Colleges", to: "/colleges" },
    { label: college?.name ?? "College", to: `/colleges/${code}` },
    { label: branch },
  ];

  if (status === "error" || (status === "done" && rows.length === 0)) {
    return (
      <div className="page trends-page">
        <PageHeader title="Branch not found" breadcrumb={crumbs} />
        <div className="empty-state"><p>We have no closing ranks for this choice code.</p><Link to={`/colleges/${code}`} className="btn btn-secondary">Back to the college</Link></div>
      </div>
    );
  }

  return (
    <div className="page trends-page">
      <PageHeader
        breadcrumb={crumbs}
        title={status === "loading" ? "Loading…" : `${branch} at ${college?.name}`}
        subtitle={`Choice code ${choiceCode}. How the closing rank moved from Round I to the last round, for each seat type${year ? `, CAP ${year}` : ""}.`}
        actions={
          gopens && college ? (
            <AddToFormButton
              variant="button"
              item={listItemFrom({ choiceCode, collegeCode: code, collegeName: college.name, branch, seatType: "GOPENS", closingMerit: gopens.last, year: year ?? 0, firstRoundClosing: gopens.first, lastRoundClosing: gopens.last })}
            />
          ) : null
        }
      />

      {gopens && gopens.first != null && gopens.last !== gopens.first && (
        <p className="card trends-insight">
          <strong>Worth knowing:</strong> for general open seats this branch closed at {formatNumber(gopens.first)} in {formatRound(1)} but reached{" "}
          {formatNumber(gopens.last)} by {formatRound(gopens.rows[gopens.rows.length - 1].round)}.
          {merit && merit > gopens.first && merit <= gopens.last
            ? " Your merit was inside that gap, so listing it above a safer choice could have moved you up in a later round."
            : ""}
        </p>
      )}

      <section className="card trends-table" aria-labelledby="trends-title">
        <div className="trends-head">
          <h2 id="trends-title">Closing rank by round</h2>
          <LadderLegend showYou={!!merit} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Seat type</th>
                {rounds.map((r) => <th key={r} scope="col" className="num">{formatRound(r)}</th>)}
                <th scope="col" className="trends-ladder-col">Round I → last{merit ? ", and you" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {seats.map((s) => (
                <tr key={s.seatType}>
                  <th scope="row">
                    <abbr title={seatTypeLabel(s.seatType)}>{seatTypeShortLabel(s.seatType)}</abbr>
                  </th>
                  {rounds.map((r) => {
                    const v = s.rows.find((x) => x.round === r);
                    return <td key={r} className="num" title={v?.source ? `${v.source}${v.sourcePage ? `, page ${v.sourcePage}` : ""}` : undefined}>{v ? formatNumber(v.closingMerit) : "—"}</td>;
                  })}
                  <td className="trends-ladder-col"><MeritLadder first={s.first} last={s.last} you={merit} domain={domain} label={seatTypeShortLabel(s.seatType)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="trends-axis"><LadderAxis domain={domain} /></div>
      </section>

      <div className="trends-missing">
        <section className="card">
          <h2 className="label">Earlier years</h2>
          <p>2023–2025 cutoffs aren't loaded yet, so four-year trends aren't shown. <Link to="/data">What's loaded</Link></p>
        </section>
        <section className="card">
          <h2 className="label">Seats left after each round</h2>
          <p>The seat matrix and vacancy lists aren't loaded yet. <Link to="/data">What's loaded</Link></p>
        </section>
      </div>
    </div>
  );
}
