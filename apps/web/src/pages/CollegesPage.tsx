import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api, type College } from "../lib/api";
import "./CollegesPage.css";

export function CollegesPage() {
  const [query, setQuery] = useState("");
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setLoading(true);
      api
        .colleges(query)
        .then((r) => setColleges(r.colleges))
        .catch(() => setColleges([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  return (
    <div className="colleges-page">
      <header className="colleges-header">
        <h1>Colleges</h1>
        <p>Search all 387 engineering colleges in the 2026 CAP.</p>
      </header>

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
                  {c.homeUniversity ? ` · ${c.homeUniversity.replace("University", "Univ.")}` : " · Autonomous"}
                </span>
              </div>
              <span className="college-item-arrow">›</span>
            </Link>
          </li>
        ))}
        {!loading && colleges.length === 0 && (
          <li className="no-colleges">No colleges found.</li>
        )}
      </ul>
    </div>
  );
}
