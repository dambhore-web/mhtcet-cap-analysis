import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type FindOption } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { listItemFrom, useList } from "../lib/list";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import { AddToFormButton } from "../components/AddToFormButton";
import { formatNumber } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import "./AddOptionsPage.css";

const PAGE = 50;
type Status = "loading" | "done" | "error";

/** My CAP plan step 1b (#113): add any choice code, not only the ones Find listed. */
export function AddOptionsPage() {
  const { profile } = useProfile();
  const list = useList();
  const merit = profile.meritNumber;
  const [all, setAll] = useState<FindOption[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  // last year's result for this merit: any, Round I, later round (stretch) or out of reach
  const [reachFilter, setReachFilter] = useState<"" | FindOption["status"]>("");
  const [shown, setShown] = useState(PAGE);
  const added = list.length;
  const [startCount] = useState(added);

  useEffect(() => {
    let live = true;
    setStatus("loading");
    api
      .find({
        merit: merit ?? 1,
        homeUniversity: profile.homeUniversity || null,
        category: profile.category ?? null,
        gender: profile.gender,
        minorityCommunity: profile.minorityCommunity,
        flags: { ews: profile.ews, tfws: profile.tfws, defence: profile.defence, pwd: profile.pwd, orphan: profile.orphan },
        subjectGroup: profile.subjectGroup,
      })
      .then((r) => {
        if (!live) return;
        setAll(r.options);
        setStatus("done");
      })
      .catch(() => live && setStatus("error"));
    return () => {
      live = false;
    };
  }, [merit, profile, retry]);

  const districts = useMemo(() => [...new Set(all.map((o) => o.district).filter((d): d is string => !!d))].sort(), [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (o) =>
        (!q || `${o.collegeName} ${o.branch} ${o.choiceCode} ${o.collegeCode}`.toLowerCase().includes(q)) &&
        (!district || o.district === district) &&
        (!reachFilter || !merit || o.status === reachFilter),
    );
  }, [all, query, district, reachFilter, merit]);

  useEffect(() => setShown(PAGE), [query, district, reachFilter]);

  return (
    <div className="page add-options-page">
      <PageHeader
        breadcrumb={[{ label: "My CAP plan", to: "/list" }, { label: "Option form", to: "/list" }, { label: "Add options" }]}
        title="Add options to your form"
        subtitle="Search every college and branch in CAP, including choices above your merit number, and add them to your option form."
        actions={
          <Link to="/list" className="btn btn-primary btn-sm">
            <Icon name="check" size={16} />
            Done{added > startCount ? ` · ${added - startCount} added` : ""}
          </Link>
        }
      />

      <div className="add-filters card">
        <div className="add-search">
          <label htmlFor="add-q" className="sr-only">Search colleges, branches or choice codes</label>
          <Icon name="search" size={18} className="add-search-icon" />
          <input id="add-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="College, branch or choice code" autoComplete="off" />
        </div>
        {districts.length > 0 && (
          <>
            <label htmlFor="add-district" className="sr-only">District</label>
            <select id="add-district" value={district} onChange={(e) => setDistrict(e.target.value)} className="add-select">
              <option value="">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </>
        )}
        {merit ? (
          <>
            <label htmlFor="add-reach" className="sr-only">Last year, for your merit</label>
            <select id="add-reach" value={reachFilter} onChange={(e) => setReachFilter(e.target.value as typeof reachFilter)} className="add-select">
              <option value="">Any result last year</option>
              <option value="round-I">Got in by Round I</option>
              <option value="later-round">Got in later (stretch choices)</option>
              <option value="out-of-range">Didn't reach my merit</option>
            </select>
          </>
        ) : null}
      </div>

      {status === "error" ? (
        <div className="empty-state" role="alert">
          <h2>Couldn't load colleges</h2>
          <button type="button" className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : status === "done" && filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No choices match</h2>
          <p>Try a shorter search, another district{merit ? ", or turn off “only where my merit got in”" : ""}.</p>
        </div>
      ) : (
        <section className="card add-results" aria-busy={status === "loading"} aria-label="Choices">
          <p className="add-count" aria-live="polite">
            {status === "loading" ? "Loading…" : `${formatNumber(filtered.length)} choices`}
          </p>
          <div className="table-scroll">
            <table className="add-table">
              <thead>
                <tr>
                  <th scope="col">College and branch</th>
                  <th scope="col">Choice code</th>
                  <th scope="col" className="num">Closing rank, R I → last</th>
                  {merit ? <th scope="col">For merit {formatNumber(merit)}</th> : null}
                  <th scope="col"><span className="sr-only">Add</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((o) => (
                  <tr key={o.choiceCode}>
                    <td>
                      <Link to={`/colleges/${o.collegeCode}`} className="add-college">{o.collegeName}</Link>
                      <span className="add-branch">
                        {o.branch} · <abbr title={seatTypeLabel(o.seatType)}>{seatTypeShortLabel(o.seatType)}</abbr>
                        {o.district ? ` · ${o.district}` : ""}
                      </span>
                      {/* phones: the code and closing rank columns are hidden, so they sit here */}
                      <span className="add-phone-meta">
                        <span className="mono">{o.choiceCode}</span> · {o.firstRoundClosing != null && o.lastRoundClosing != null ? `${formatNumber(o.firstRoundClosing)} → ${formatNumber(o.lastRoundClosing)}` : formatNumber(o.closingMerit)}
                      </span>
                    </td>
                    <td className="add-code">{o.choiceCode}</td>
                    <td className="num">
                      {o.firstRoundClosing != null ? formatNumber(o.firstRoundClosing) : "—"} → {o.lastRoundClosing != null ? formatNumber(o.lastRoundClosing) : "—"}
                    </td>
                    {merit ? <td><StatusBadge status={o.status} round={o.round} /></td> : null}
                    <td><AddToFormButton item={listItemFrom(o)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown < filtered.length && (
            <button type="button" className="btn btn-secondary btn-block add-more" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, filtered.length - shown)} more
            </button>
          )}
        </section>
      )}
    </div>
  );
}
