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

function statusLabel(status: string | null): string {
  if (!status) return "";
  if (status.includes("Autonomous")) return "Autonomous";
  if (status.includes("Minority")) return "Minority";
  if (status.includes("Aided") && !status.includes("Un-Aided")) return "Govt-Aided";
  if (status === "Un-Aided") return "Un-Aided";
  return status.split(" ")[0];
}

function collegeTile(name: string): string {
  return (
    name
      .split(" ")
      .filter((w) => /^[A-Z]/.test(w) && w.length > 2)
      .slice(0, 2)
      .map((w) => w[0])
      .join("") || "–"
  );
}

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
      <div className="colleges-content">

        <header className="colleges-header">
          <div>
            <h1>Colleges</h1>
            <p>387 engineering colleges in the 2026 MHT-CET CAP</p>
          </div>
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
              autoFocus
            />
            {loading && <span className="colleges-spinner" aria-label="Searching" />}
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
            <span>
              {hasFilter
                ? `${colleges.length} match${colleges.length !== 1 ? "es" : ""}${total > colleges.length ? ` of ${total}` : ""}`
                : `${total > 0 ? total : 387} colleges`}
            </span>
            {hasFilter && (
              <button className="colleges-clear" onClick={() => { setQuery(""); setUniversity(""); }}>
                Clear ×
              </button>
            )}
          </div>
        </div>

        <div className="colleges-list">
          {colleges.map((c) => {
            const label = statusLabel(c.status);
            return (
              <Link key={c.code} to={`/colleges/${c.code}`} className="college-row">
                <div className="college-row-tile" aria-hidden="true">
                  {collegeTile(c.name)}
                </div>
                <div className="college-row-detail">
                  <span className="college-row-name">{c.name}</span>
                  <span className="college-row-meta">
                    {c.code}
                    {c.homeUniversity
                      ? ` · ${c.homeUniversity.replace(" University", " Univ.")}`
                      : " · Autonomous"}
                  </span>
                </div>
                {label && (
                  <span className={`college-row-badge college-row-badge-${label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
                    {label}
                  </span>
                )}
                <span className="college-row-arrow" aria-hidden="true">›</span>
              </Link>
            );
          })}
          {!loading && colleges.length === 0 && (
            <div className="colleges-empty">No colleges found for this filter.</div>
          )}
        </div>

      </div>
    </div>
  );
}
