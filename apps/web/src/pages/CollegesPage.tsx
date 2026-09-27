import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api, type College } from "../lib/api";
import "./CollegesPage.css";

const UNIVERSITIES = [
  "University of Mumbai",
  "Savitribai Phule Pune University",
  "Dr. Babasaheb Ambedkar Marathwada University",
  "Sant Gadge Baba Amravati University",
  "Rashtrasant Tukadoji Maharaj Nagpur University",
  "Swami Ramanand Teertha Marathwada University",
  "North Maharashtra University",
  "Dr. Babasaheb Ambedkar Technological University",
  "Solapur University",
  "Gondwana University",
];

export function CollegesPage() {
  const [query, setQuery] = useState("");
  const [university, setUniversity] = useState("");
  const [colleges, setColleges] = useState<College[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setLoading(true);
      api
        .colleges(query, university || undefined)
        .then((r) => { setColleges(r.colleges); setTotal(r.total ?? r.count); })
        .catch(() => setColleges([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, university]);

  const hasFilter = !!query || !!university;

  return (
    <div className="colleges-page">
      <header className="colleges-header">
        <h1>Colleges</h1>
        <p>Search and filter 387 engineering colleges in the 2026 CAP.</p>
      </header>

      <div className="colleges-filters">
        <div className="colleges-search-wrap">
          <label htmlFor="college-search" className="sr-only">Search colleges</label>
          <input
            id="college-search"
            type="search"
            className="colleges-search"
            placeholder="Search by name or code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {loading && <span className="search-spinner" aria-label="Searching" />}
        </div>

        <select
          className="colleges-uni-select"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          aria-label="Filter by university"
        >
          <option value="">All universities</option>
          {UNIVERSITIES.map((u) => (
            <option key={u} value={u}>{u.replace(" University", " Univ.")}</option>
          ))}
        </select>

        <div className="colleges-meta">
          {hasFilter
            ? <span>{colleges.length} match{colleges.length !== 1 ? "es" : ""}{total > colleges.length ? ` of ${total}` : ""}</span>
            : <span>{total > 0 ? `${total} colleges` : "387 colleges"}</span>
          }
          {hasFilter && (
            <button className="colleges-clear" onClick={() => { setQuery(""); setUniversity(""); }}>
              Clear ×
            </button>
          )}
        </div>
      </div>

      <ul className="colleges-list" role="list">
        {colleges.map((c) => (
          <li key={c.code} role="listitem">
            <Link to={`/colleges/${c.code}`} className="college-item">
              <div className="college-item-tile" aria-hidden="true">
                {c.name.split(" ").filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("") || c.code.slice(-2)}
              </div>
              <div className="college-item-detail">
                <span className="college-item-name">{c.name}</span>
                <span className="college-item-meta">
                  {c.code}
                  {c.homeUniversity ? ` · ${c.homeUniversity.replace(" University", " Univ.")}` : " · Autonomous"}
                </span>
              </div>
              <span className="college-item-arrow">›</span>
            </Link>
          </li>
        ))}
        {!loading && colleges.length === 0 && (
          <li className="no-colleges">No colleges found for this filter.</li>
        )}
      </ul>
    </div>
  );
}
