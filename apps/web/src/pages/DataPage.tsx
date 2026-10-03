import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DataMeta } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { Icon, type IconName } from "../components/Icon";
import { formatNumber, formatRound } from "../lib/format";
import { usePageMeta } from "../lib/seo";
import "./DataPage.css";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "book", title: "Official PDFs", body: "Cutoff lists for every round, merit lists, the seat matrix and allotment lists, from the State CET Cell." },
  { icon: "steps", title: "Read by code", body: "Parsers read each page and pull out college, branch, seat type, round and closing merit. Nobody types numbers in by hand." },
  { icon: "check", title: "Checked", body: "Seat counts must match each branch's printed “CAP Seats”, and Round I cutoffs must match the allotment lists." },
  { icon: "clipboard", title: "Stored with source", body: "Each value keeps the PDF name and page number, so any number can be traced back. You'll see it under “Show as a table” and in Ask GetMeCollege answers." },
  { icon: "lock", title: "No personal data", body: "GetMeCollege never stores candidate names or application IDs from the lists." },
];

type Status = "loading" | "done" | "error";

/** Journey J13, "Can I trust these numbers?" (#114). */
export function DataPage() {
  usePageMeta({ title: "Where our numbers come from", description: "The official CET Cell lists behind every closing merit number on GetMeCollege, how they are read and checked, and what past cutoffs can't tell you." });
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    api.meta().then((m) => { setMeta(m); setStatus("done"); }).catch(() => setStatus("error"));
  }, []);

  return (
    <div className="page page--narrow data-page">
      <PageHeader
        title="Where our numbers come from"
        subtitle="Every cutoff in GetMeCollege is read by software from the PDFs the State CET Cell publishes, checked, and stored with the file and page it came from."
      />

      <ol className="data-steps">
        {STEPS.map((s) => (
          <li key={s.title} className="card">
            <Icon name={s.icon} size={20} />
            <div>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="page-section" aria-labelledby="data-now">
        <h2 id="data-now" className="data-h2">What's loaded now</h2>
        {status === "loading" && <p className="data-muted">Loading…</p>}
        {status === "error" && <p className="data-muted" role="alert">Couldn't load the data summary right now.</p>}
        {meta && (
          <>
            <dl className="data-stats">
              <div className="card"><dt>Colleges</dt><dd>{formatNumber(meta.colleges)}</dd></div>
              <div className="card"><dt>Branches</dt><dd>{formatNumber(meta.branches)}</dd></div>
              <div className="card"><dt>Cutoff values</dt><dd>{formatNumber(meta.cutoffRows)}</dd></div>
              <div className="card"><dt>CAP year</dt><dd>{meta.year}</dd></div>
            </dl>

            <div className="card data-table">
              <div className="table-scroll">
                <table>
                  <caption className="sr-only">Cutoff lists loaded</caption>
                  <thead>
                    <tr>
                      <th scope="col">List</th>
                      <th scope="col">Round</th>
                      <th scope="col" className="num">Values</th>
                      <th scope="col">Source files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meta.lists.map((l) => (
                      <tr key={`${l.list}-${l.round}`}>
                        <td>{l.list === "AI" ? "All India" : l.list === "MH" ? "Maharashtra state" : l.list}</td>
                        <td>{formatRound(l.round)}</td>
                        <td className="num data-values">
                          <span className="data-bar" aria-hidden="true">
                            <i className={l.list === "MH" ? "mh" : l.list === "AI" ? "ai" : "other"} style={{ width: `${Math.max((l.rows / Math.max(...meta.lists.map((x) => x.rows))) * 100, 1)}%` }} />
                          </span>
                          {formatNumber(l.rows)}
                        </td>
                        <td className="data-files">{l.files.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <ul className="data-coverage">
              <li>
                <strong>Fees:</strong> {meta.fees.colleges} of {meta.colleges} colleges, {meta.fees.verified} checked against the Fee Regulating Authority's order.
              </li>
              <li>
                <strong>Districts:</strong>{" "}
                {meta.districtsLoaded ? `${meta.districtsLoaded} of ${meta.colleges} colleges` : "not loaded yet, so district filters are hidden"}.
              </li>
              <li>
                <strong>Earlier years:</strong>{" "}
                {meta.earlierYears?.length
                  ? `${meta.earlierYears.join(", ")} state-level cutoffs, shown as year-by-year trends on each branch page`
                  : "not loaded yet, so year-by-year trends are hidden"}.
              </li>
              <li><strong>Seats left per round:</strong> not shown.</li>
            </ul>

            {meta.loads.length > 0 && (
              <section aria-labelledby="data-loads">
                <h3 id="data-loads" className="label">Recent data loads</h3>
                <ul className="data-loads">
                  {meta.loads.map((l) => (
                    <li key={l.id}>
                      {new Date(l.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {l.status}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </section>

      <p className="data-foot">
        GetMeCollege is an unofficial guide. Past cutoffs describe what happened, not what will happen. Read the <Link to="/legal">disclaimer</Link>.
      </p>
    </div>
  );
}
