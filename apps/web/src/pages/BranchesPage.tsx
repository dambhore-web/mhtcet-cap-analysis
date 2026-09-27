import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { api, BRANCH_GROUPS, type FindOption } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { addToList, isInList } from "../lib/list";
import "./BranchesPage.css";

type BranchGroup = typeof BRANCH_GROUPS[number];

// Log scale helpers for the per-row mini dumbbell
const LOG_TICKS = [100, 500, 1000, 5000, 10000, 50000, 100000, 400000];

function logX(v: number, a: number, z: number, w: number): number {
  if (v <= 0 || a >= z) return 0;
  return ((Math.log(v) - Math.log(a)) / (Math.log(z) - Math.log(a))) * w;
}

function MiniDumbbell({
  r1Merit,
  lastMerit,
  userMerit,
  domainMin,
  domainMax,
  status,
}: {
  r1Merit: number;
  lastMerit: number | null;
  userMerit: number | null;
  domainMin: number;
  domainMax: number;
  status: "round-I" | "later-round" | "out-of-range";
}) {
  const W = 200;
  const H = 20;
  const CY = 10;
  const dotColor = status === "round-I" ? "#166534" : status === "later-round" ? "#92400e" : "#94a3b8";
  const x1 = logX(r1Merit, domainMin, domainMax, W);
  const xL = lastMerit ? logX(lastMerit, domainMin, domainMax, W) : x1;
  const xu = userMerit ? logX(userMerit, domainMin, domainMax, W) : null;

  return (
    <svg width={W} height={H} className="branch-dumbbell" aria-hidden="true">
      {/* Axis baseline */}
      <line x1={0} y1={CY} x2={W} y2={CY} stroke="#e3e6ec" strokeWidth={1} />
      {/* Connector */}
      {lastMerit && lastMerit !== r1Merit && (
        <line x1={x1} y1={CY} x2={xL} y2={CY} stroke={dotColor} strokeWidth={2} strokeOpacity={0.4} />
      )}
      {/* Last round dot */}
      {lastMerit && lastMerit !== r1Merit && (
        <circle cx={xL} cy={CY} r={4} fill={dotColor} fillOpacity={0.55} stroke="white" strokeWidth={1.5} />
      )}
      {/* R1 dot */}
      <circle cx={x1} cy={CY} r={6} fill={dotColor} stroke="white" strokeWidth={2} />
      {/* You line */}
      {xu !== null && (
        <line x1={xu} y1={3} x2={xu} y2={H - 3} stroke="#f5b301" strokeWidth={2} strokeLinecap="round" />
      )}
    </svg>
  );
}

export function BranchesPage() {
  const { profile } = useProfile();
  const [selectedGroup, setSelectedGroup] = useState<BranchGroup>(BRANCH_GROUPS[0]);
  const [results, setResults] = useState<FindOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [inListSet, setInListSet] = useState<Set<string>>(new Set());

  const hasMerit = !!profile.meritNumber;

  useEffect(() => {
    setLoading(true);
    setResults([]);
    const merit = profile.meritNumber ?? 50000;
    api.find({
      merit,
      homeUniversity: profile.homeUniversity || null,
      category: profile.category ?? null,
      gender: profile.gender,
      minorityCommunity: null,
      flags: { ews: profile.ews, tfws: profile.tfws, defence: profile.defence, pwd: profile.pwd, orphan: profile.orphan },
      subjectGroup: profile.subjectGroup,
      filters: { branchGroup: selectedGroup },
    })
      .then((r) => setResults(r.options))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [selectedGroup, profile]);

  // Refresh in-list state after adds
  function refreshList() {
    const s = new Set<string>();
    results.forEach((r) => { if (isInList(r.choiceCode)) s.add(r.choiceCode); });
    setInListSet(s);
  }

  useEffect(() => { refreshList(); }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute shared log scale domain from all R1 merits
  const { domainMin, domainMax } = useMemo(() => {
    if (results.length === 0) return { domainMin: 100, domainMax: 400000 };
    const merits = results.map((r) => r.closingMerit);
    const mn = Math.min(...merits);
    const mx = Math.max(...merits);
    const a = LOG_TICKS.filter((t) => t <= mn).at(-1) ?? LOG_TICKS[0];
    const z = LOG_TICKS.find((t) => t >= mx) ?? LOG_TICKS[LOG_TICKS.length - 1];
    return { domainMin: a, domainMax: z };
  }, [results]);

  // Group results by branch name, picking best (lowest R1) per college
  const rows = useMemo(() => results, [results]);

  function handleAdd(opt: FindOption) {
    addToList({
      choiceCode: opt.choiceCode,
      collegeCode: opt.collegeCode,
      collegeName: opt.collegeName,
      branch: opt.branch,
      seatType: opt.seatType,
      closingMerit: opt.closingMerit,
      year: opt.year,
    });
    setInListSet((s) => new Set([...s, opt.choiceCode]));
  }

  const statusLabel: Record<string, string> = {
    "round-I": "R I",
    "later-round": "by R IV",
    "out-of-range": "Out of range",
  };

  return (
    <div className="branches-page">
      <div className="branches-content">
        <div className="branches-header">
          <div>
            <h1>By branch</h1>
            <p>Choose a branch group to see every college that offers it{hasMerit ? ` for merit ${profile.meritNumber!.toLocaleString("en-IN")}` : ""}</p>
          </div>
          {!hasMerit && (
            <Link to="/profile" className="branches-set-merit">Set your merit →</Link>
          )}
        </div>

        {/* Branch group selector */}
        <div className="branches-group-selector">
          {BRANCH_GROUPS.map((g) => (
            <button
              key={g}
              className={`branches-group-btn${g === selectedGroup ? " active" : ""}`}
              onClick={() => setSelectedGroup(g)}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Scale legend */}
        {rows.length > 0 && (
          <div className="branches-scale-legend">
            <span>Merit scale (log) →</span>
            <div className="branches-legend-dots">
              <span className="bl-dot bl-r1" />R I closing merit
              <span className="bl-dot bl-last" />Last round
              <span className="bl-line bl-you" />Your merit
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="branches-loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="branches-empty">No data found for {selectedGroup}.</div>
        ) : (
          <div className="branches-list">
            {rows.map((opt) => {
              const inList = inListSet.has(opt.choiceCode);
              return (
                <div key={opt.choiceCode} className={`branch-row branch-row-${opt.status}`}>
                  <div className="branch-row-main">
                    <Link to={`/colleges/${opt.collegeCode}`} className="branch-college-name">
                      {opt.collegeName}
                    </Link>
                    <span className="branch-name">{opt.branch}</span>
                  </div>

                  <MiniDumbbell
                    r1Merit={opt.closingMerit}
                    lastMerit={null}
                    userMerit={profile.meritNumber ?? null}
                    domainMin={domainMin}
                    domainMax={domainMax}
                    status={opt.status}
                  />

                  <div className="branch-row-right">
                    <span className={`branch-status-pill branch-status-${opt.status}`}>
                      {statusLabel[opt.status]}
                    </span>
                    <button
                      className={`branch-add-btn${inList ? " added" : ""}`}
                      onClick={() => !inList && handleAdd(opt)}
                      disabled={inList}
                    >
                      {inList ? "✓" : "+"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
