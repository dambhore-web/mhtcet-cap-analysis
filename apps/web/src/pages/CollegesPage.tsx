import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { api, type College } from "../lib/api";
import { useCompare } from "../lib/CompareContext";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { avatarTint, collegeInitials, formatNumber } from "../lib/format";
import { logBounds, logScale, tickLabel, ticksIn } from "../lib/logScale";
import { useProfile } from "../lib/ProfileContext";
import { UNIVERSITIES } from "../lib/universities";
import "./CollegesPage.css";

type Status = "loading" | "done" | "error";
type Sort = "az" | "reach" | "hard" | "easy";

export function CollegesPage() {
  const [query, setQuery] = useState("");
  const [university, setUniversity] = useState("");
  const [district, setDistrict] = useState("");
  const [collegeType, setCollegeType] = useState("");
  const [districts, setDistricts] = useState<string[]>([]);
  const [collegeTypes, setCollegeTypes] = useState<string[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pin, unpin, isPinned, canPin } = useCompare();
  const { profile } = useProfile();
  const merit = profile.meritNumber;
  const [sort, setSort] = useState<Sort>(merit ? "reach" : "az");
  // Each college's branches at their latest-round general open, state-level closing rank
  const [byCollege, setByCollege] = useState<Map<string, number[]> | null>(null);

  useEffect(() => {
    let live = true;
    api
      .openLatest()
      .then((r) => {
        if (!live) return;
        const m = new Map<string, number[]>();
        for (const row of r.rows) m.set(row[1], [...(m.get(row[1]) ?? []), row[4]]);
        setByCollege(m);
      })
      .catch(() => live && setByCollege(new Map()));
    return () => {
      live = false;
    };
  }, []);

  const domain = useMemo(() => logBounds(byCollege ? [...byCollege.values()].flat() : []), [byCollege]);
  const sorted = useMemo(() => {
    const vals = (c: College) => byCollege?.get(c.code) ?? [];
    const reachOf = (c: College) => (merit ? vals(c).filter((v) => merit <= v).length : 0);
    const hardest = (c: College) => (vals(c).length ? Math.min(...vals(c)) : Infinity);
    const easiest = (c: College) => (vals(c).length ? Math.max(...vals(c)) : -Infinity);
    const list = [...colleges];
    if (sort === "reach") list.sort((a, b) => reachOf(b) - reachOf(a) || hardest(a) - hardest(b));
    else if (sort === "hard") list.sort((a, b) => hardest(a) - hardest(b));
    else if (sort === "easy") list.sort((a, b) => easiest(b) - easiest(a));
    return list;
  }, [colleges, byCollege, sort, merit]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setStatus("loading");
      api
        .colleges(query, university || undefined, { district, type: collegeType })
        .then((r) => {
          setColleges(r.colleges);
          setTotal(r.total ?? r.count);
          if (r.districts) setDistricts(r.districts);
          if (r.collegeTypes) setCollegeTypes(r.collegeTypes);
          setStatus("done");
        })
        .catch(() => {
          setColleges([]);
          setStatus("error");
        });
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, university, district, collegeType, retry]);

  const hasFilter = !!query || !!university || !!district || !!collegeType;
  const clear = () => { setQuery(""); setUniversity(""); setDistrict(""); setCollegeType(""); };

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
            placeholder="College name, code or district"
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

        {districts.length > 0 && (
          <>
            <label htmlFor="college-district" className="sr-only">Filter by district</label>
            <select id="college-district" className="colleges-uni-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </>
        )}
        {collegeTypes.length > 0 && (
          <>
            <label htmlFor="college-type" className="sr-only">Filter by college type</label>
            <select id="college-type" className="colleges-uni-select" value={collegeType} onChange={(e) => setCollegeType(e.target.value)}>
              <option value="">All types</option>
              {collegeTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </>
        )}
      </div>

      <div className="colleges-meta" aria-live="polite">
        <label className="colleges-sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {merit ? <option value="reach">Most branches within reach</option> : null}
            <option value="hard">Hardest to get first</option>
            <option value="easy">Easiest to get first</option>
            <option value="az">Name, A to Z</option>
          </select>
        </label>
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
          <li className="colleges-axis" aria-hidden="true">
            <span>College</span>
            <span className="colleges-axis-ticks">
              {ticksIn(domain, true).map((t) => (
                <span key={t} style={{ left: `${logScale(domain, 0, 100)(t)}%` }}>{tickLabel(t)}</span>
              ))}
            </span>
            <span>{merit ? "Within reach" : "Branches"}</span>
            <span />
          </li>
          {sorted.map((c) => {
            const pinned = isPinned(c.code);
            const vals = byCollege?.get(c.code) ?? [];
            const reach = merit ? vals.filter((v) => merit <= v).length : null;
            return (
              <li key={c.code} className="college-item">
                <span className="college-item-tile" style={{ background: avatarTint(c.code) }} aria-hidden="true">
                  {collegeInitials(c.name, c.code)}
                </span>
                <Link to={`/colleges/${c.code}`} className="college-item-detail">
                  <span className="college-item-name">{c.name}</span>
                  <span className="college-item-meta">
                    Code {c.code}
                    {c.district ? ` · ${c.district}` : ""}
                    {c.collegeType ? ` · ${c.collegeType}` : ""}
                    {c.homeUniversity ? ` · ${c.homeUniversity}` : c.collegeType ? "" : " · Autonomous"}
                  </span>
                </Link>
                <span className="college-item-strip">
                  {vals.length ? (
                    <CollegeStrip vals={vals} merit={merit} domain={domain} name={c.name} />
                  ) : byCollege ? (
                    <span className="college-item-none">No state-level open seats</span>
                  ) : null}
                </span>
                <span className={`college-item-reach${reach === 0 ? " none" : ""}`}>
                  {vals.length ? (reach != null ? <><b>{reach}</b> of {vals.length}</> : <><b>{vals.length}</b> branches</>) : null}
                </span>
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

/** One college's branches as lines on the shared log axis, with the student's merit as a dark line. */
function CollegeStrip({ vals, merit, domain, name }: { vals: number[]; merit: number | null; domain: [number, number]; name: string }) {
  const W = 300;
  const x = logScale(domain, 3, W - 6);
  return (
    <svg
      viewBox={`0 0 ${W} 24`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${name}: ${vals.length} branches, closing ranks ${formatNumber(Math.min(...vals))} to ${formatNumber(Math.max(...vals))}`}
    >
      <rect x={0} y={4} width={W} height={16} rx={3} className="strip-bg" />
      {merit != null && <rect x={x(merit)} y={4} width={Math.max(W - x(merit), 0)} height={16} className="strip-in" />}
      {vals.map((v, i) => (
        <line key={i} x1={x(v)} x2={x(v)} y1={4} y2={20} className={merit != null && merit <= v ? "strip-line reach" : "strip-line"} />
      ))}
      {merit != null && <line x1={x(merit)} x2={x(merit)} y1={0} y2={24} className="strip-you" />}
    </svg>
  );
}
