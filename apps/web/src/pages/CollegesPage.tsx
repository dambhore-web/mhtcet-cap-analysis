import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api, type College } from "../lib/api";
import { useCompare } from "../lib/CompareContext";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { avatarTint, collegeInitials } from "../lib/format";
import { UNIVERSITIES } from "../lib/universities";
import "./CollegesPage.css";

type Status = "loading" | "done" | "error";

export function CollegesPage() {
  const [query, setQuery] = useState("");
  const [university, setUniversity] = useState("");
  const [colleges, setColleges] = useState<College[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pin, unpin, isPinned, canPin } = useCompare();

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setStatus("loading");
      api
        .colleges(query, university || undefined)
        .then((r) => {
          setColleges(r.colleges);
          setTotal(r.total ?? r.count);
          setStatus("done");
        })
        .catch(() => {
          setColleges([]);
          setStatus("error");
        });
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, university, retry]);

  const hasFilter = !!query || !!university;
  const clear = () => { setQuery(""); setUniversity(""); };

  return (
    <div className="page colleges-page">
      <PageHeader
        title="Colleges"
        subtitle="Search all 387 engineering colleges in CAP. Open a college to see its closing ranks, fees and branches, or add up to 3 to compare."
      />

      <div className="colleges-filters card">
        <div className="colleges-search-wrap">
          <label htmlFor="college-search" className="sr-only">Search colleges</label>
          <Icon name="search" size={18} className="colleges-search-icon" />
          <input
            id="college-search"
            type="search"
            className="colleges-search"
            placeholder="College name, city or code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {status === "loading" && <span className="search-spinner" role="status" aria-label="Searching" />}
        </div>

        <label htmlFor="college-uni" className="sr-only">Filter by university</label>
        <select
          id="college-uni"
          className="colleges-uni-select"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
        >
          <option value="">All universities</option>
          {UNIVERSITIES.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      <div className="colleges-meta" aria-live="polite">
        <span>
          {status === "done" &&
            (hasFilter
              ? `${colleges.length} ${colleges.length === 1 ? "match" : "matches"}${total > colleges.length ? ` of ${total}` : ""}`
              : `${total || 387} colleges`)}
        </span>
        {hasFilter && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
            <Icon name="close" size={14} />
            Clear filters
          </button>
        )}
      </div>

      {status === "error" ? (
        <div className="empty-state">
          <h2>Couldn't load colleges</h2>
          <p>Check your connection and try again.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : status === "done" && colleges.length === 0 ? (
        <div className="empty-state">
          <h2>No colleges match</h2>
          <p>Try a shorter name, the college code (for example 6006), or clear the university filter.</p>
          {hasFilter && <button type="button" className="btn btn-secondary" onClick={clear}>Clear filters</button>}
        </div>
      ) : (
        <ul className="colleges-list">
          {colleges.map((c) => {
            const pinned = isPinned(c.code);
            return (
              <li key={c.code} className="college-item">
                <span className="college-item-tile" style={{ background: avatarTint(c.code) }} aria-hidden="true">
                  {collegeInitials(c.name, c.code)}
                </span>
                <Link to={`/colleges/${c.code}`} className="college-item-detail">
                  <span className="college-item-name">{c.name}</span>
                  <span className="college-item-meta">
                    Code {c.code}
                    {c.homeUniversity ? ` · ${c.homeUniversity}` : " · Autonomous"}
                  </span>
                </Link>
                <button
                  type="button"
                  className={`college-item-pin${pinned ? " pinned" : ""}`}
                  onClick={() => (pinned ? unpin(c.code) : pin({ code: c.code, name: c.name }))}
                  disabled={!pinned && !canPin}
                  aria-pressed={pinned}
                  aria-label={pinned ? `Remove ${c.name} from compare` : `Add ${c.name} to compare`}
                  title={!pinned && !canPin ? "You can compare up to 3 colleges" : pinned ? "Remove from compare" : "Add to compare"}
                >
                  <Icon name={pinned ? "check" : "pin"} size={16} />
                  <span className="college-item-pin-text">{pinned ? "Comparing" : "Compare"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
