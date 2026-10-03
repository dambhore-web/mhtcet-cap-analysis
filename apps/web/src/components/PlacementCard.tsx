import type { CollegeClaims, CollegePlacement } from "../lib/api";
import { formatNumber } from "../lib/format";
import { formatLakh, latestPlaced, recentBatches, salaryChange } from "../lib/placement";
import "./PlacementCard.css";

/** The figures a college publishes on its own website: highest, average, median package, placement %. */
function CollegeFigures({ c }: { c: CollegeClaims }) {
  const stats: Array<[string, string]> = [];
  if (c.highest !== null) stats.push(["Highest package", formatLakh(c.highest)]);
  if (c.average !== null) stats.push(["Average package", formatLakh(c.average)]);
  if (c.median !== null) stats.push(["Median package", formatLakh(c.median)]);
  if (c.placedPct !== null) stats.push(["Placed", `${c.placedPct}%`]);
  return (
    <div className="cp-placement-claims">
      <h3 className="cp-placement-sub">
        College's own figures{c.year ? ` (${c.year})` : " (year not stated)"}
      </h3>
      <dl className="cp-placement-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="cp-placement-note">
        <span className="badge badge-sample">Unverified</span> As published on the college's website
        {c.sources.length ? (
          <>
            {" "}(
            {c.sources.slice(0, 2).map((u, i) => (
              <span key={u}>
                {i > 0 && ", "}
                <a href={u} target="_blank" rel="noreferrer">source{c.sources.length > 1 ? ` ${i + 1}` : ""}</a>
              </span>
            ))}
            )
          </>
        ) : null}
        ; read on {c.crawledAt}. Highest packages are usually one or two offers.
      </p>
    </div>
  );
}

/** Placement of B.E./B.Tech graduates: the college's own figures and its NIRF data (issue #132). */
export function PlacementCard({ data }: { data: CollegePlacement }) {
  const latest = latestPlaced(data.batches);
  const rows = recentBatches(data.batches);
  const change = salaryChange(rows.slice().reverse());
  const sources = [...new Map(rows.map((b) => [b.sourceUrl, b])).values()].sort((a, b) => b.nirfYear - a.nirfYear);

  return (
    <section className="page-section card cp-placement" aria-labelledby="cp-placement-title">
      <h2 id="cp-placement-title" className="label">Placement (B.E./B.Tech graduates)</h2>
      {data.collegeClaims && <CollegeFigures c={data.collegeClaims} />}
      {rows.length > 0 && (
        <>
          {data.collegeClaims && <h3 className="cp-placement-sub">Reported to NIRF</h3>}
          {latest && latest.placed !== null ? (
            <p className="cp-placement-main">
              In {latest.graduationYear}, <strong>{formatNumber(latest.placed)} of {formatNumber(latest.graduates)}</strong> graduates
              {latest.placedPct !== null ? ` (${latest.placedPct}%)` : ""} were placed
              {latest.medianSalary !== null ? (
                <>, at a median salary of <strong>{formatLakh(latest.medianSalary)}</strong> a year</>
              ) : null}
              .{latest.higherStudies ? ` ${formatNumber(latest.higherStudies)} went on to higher studies.` : ""}
            </p>
          ) : (
            <p className="cp-placement-main">The college reported no placement figures for its recent batches.</p>
          )}
          {change && (
            <p className="cp-placement-trend">
              Median salary {change.change >= 0 ? "up" : "down"} {Math.abs(Math.round(change.change * 100))}% from {change.from.graduationYear} to{" "}
              {change.to.graduationYear}.
            </p>
          )}
          <div className="table-scroll">
            <table className="cp-placement-table">
              <caption className="sr-only">Placement by graduating batch, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Batch</th>
                  <th scope="col">Graduates</th>
                  <th scope="col">Placed</th>
                  <th scope="col">Median salary</th>
                  <th scope="col">Higher studies</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.graduationYear}>
                    <th scope="row">{b.graduationYear}</th>
                    <td>{formatNumber(b.graduates)}</td>
                    <td>{b.placed === null ? "–" : <>{formatNumber(b.placed)}{b.placedPct !== null && <span className="cp-placement-pct"> {b.placedPct}%</span>}</>}</td>
                    <td>{b.medianSalary === null ? "–" : formatLakh(b.medianSalary)}</td>
                    <td>{b.higherStudies === null ? "–" : formatNumber(b.higherStudies)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cp-placement-note">
            Reported by the college to NIRF; all B.E./B.Tech branches together, not checked independently. Source:{" "}
            {sources.map((s, i) => (
              <span key={s.sourceUrl}>
                {i > 0 && ", "}
                <a href={s.sourceUrl} target="_blank" rel="noreferrer">NIRF {s.nirfYear} ({s.nirfCategory})</a>
              </span>
            ))}
            .
          </p>
        </>
      )}
    </section>
  );
}
