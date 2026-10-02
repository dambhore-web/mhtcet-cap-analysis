import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, BRANCH_GROUPS, type FindOption, type Category } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import { AddToFormButton } from "../components/AddToFormButton";
import { listItemFrom } from "../lib/list";
import { LadderAxis, LadderLegend, MeritLadder, ladderDomain } from "../components/MeritLadder";
import { formatNumber } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import { logBounds, logScale } from "../lib/logScale";
import "./BranchesPage.css";

/** One branch group's closing ranks as a small barcode, with the student's merit as a line. */
function GroupBarcode({ vals, merit, domain, active }: { vals: number[]; merit: number | null; domain: [number, number]; active: boolean }) {
  const W = 200;
  const x = logScale(domain, 1, W - 2);
  return (
    <svg className={`branches-group-strip${active ? " active" : ""}`} viewBox={`0 0 ${W} 16`} preserveAspectRatio="none" aria-hidden="true">
      {vals.map((v, i) => <line key={i} x1={x(v)} x2={x(v)} y1={1} y2={15} className={merit != null && merit <= v ? "reach" : undefined} />)}
      {merit != null && <line x1={x(merit)} x2={x(merit)} y1={0} y2={16} className="you" />}
    </svg>
  );
}

type BranchGroup = (typeof BRANCH_GROUPS)[number];
type Status = "loading" | "done" | "error";

interface SeatFilter {
  label: string;
  category: Category | null;
  gender: "M" | "F";
  ews?: boolean;
  tfws?: boolean;
  defence?: boolean;
  pwd?: boolean;
  orphan?: boolean;
  /** Optional seat-type prefix to narrow displayed rows (e.g. "L", "PWDR", "DEFR"). */
  prefix?: string;
}

const SEAT_FILTERS: SeatFilter[] = [
  // ── General (G) ──────────────────────────────────────────────────────────
  { label: "General open",          category: null,   gender: "M" },
  { label: "General OBC",           category: "OBC",  gender: "M" },
  { label: "General SEBC",          category: "SEBC", gender: "M" },
  { label: "General SC",            category: "SC",   gender: "M" },
  { label: "General ST",            category: "ST",   gender: "M" },
  { label: "General VJ/DT",         category: "VJ",   gender: "M" },
  { label: "General NT-B",          category: "NT1",  gender: "M" },
  { label: "General NT-C",          category: "NT2",  gender: "M" },
  { label: "General NT-D",          category: "NT3",  gender: "M" },
  // ── Ladies (L) ───────────────────────────────────────────────────────────
  { label: "Ladies open",           category: null,   gender: "F", prefix: "L" },
  { label: "Ladies OBC",            category: "OBC",  gender: "F", prefix: "L" },
  { label: "Ladies SEBC",           category: "SEBC", gender: "F", prefix: "L" },
  { label: "Ladies SC",             category: "SC",   gender: "F", prefix: "L" },
  { label: "Ladies ST",             category: "ST",   gender: "F", prefix: "L" },
  { label: "Ladies VJ/DT",          category: "VJ",   gender: "F", prefix: "L" },
  { label: "Ladies NT-B",           category: "NT1",  gender: "F", prefix: "L" },
  { label: "Ladies NT-C",           category: "NT2",  gender: "F", prefix: "L" },
  { label: "Ladies NT-D",           category: "NT3",  gender: "F", prefix: "L" },
  // ── PWD ──────────────────────────────────────────────────────────────────
  { label: "PWD open",              category: null,   gender: "M", pwd: true, prefix: "PWD" },
  { label: "PWD OBC",               category: "OBC",  gender: "M", pwd: true, prefix: "PWD" },
  { label: "PWD SEBC",              category: "SEBC", gender: "M", pwd: true, prefix: "PWD" },
  { label: "PWD SC",                category: "SC",   gender: "M", pwd: true, prefix: "PWD" },
  { label: "PWD ST",                category: "ST",   gender: "M", pwd: true, prefix: "PWD" },
  { label: "PWD VJ/DT",             category: "VJ",   gender: "M", pwd: true, prefix: "PWD" },
  { label: "PWD NT-B",              category: "NT1",  gender: "M", pwd: true, prefix: "PWD" },
  { label: "PWD NT-C",              category: "NT2",  gender: "M", pwd: true, prefix: "PWD" },
  { label: "PWD NT-D",              category: "NT3",  gender: "M", pwd: true, prefix: "PWD" },
  // ── PWDR (PWD common reserved) ────────────────────────────────────────────
  { label: "PWD common OBC",        category: "OBC",  gender: "M", pwd: true, prefix: "PWDR" },
  { label: "PWD common SEBC",       category: "SEBC", gender: "M", pwd: true, prefix: "PWDR" },
  { label: "PWD common SC",         category: "SC",   gender: "M", pwd: true, prefix: "PWDR" },
  { label: "PWD common ST",         category: "ST",   gender: "M", pwd: true, prefix: "PWDR" },
  { label: "PWD common VJ/DT",      category: "VJ",   gender: "M", pwd: true, prefix: "PWDR" },
  { label: "PWD common NT-B",       category: "NT1",  gender: "M", pwd: true, prefix: "PWDR" },
  { label: "PWD common NT-C",       category: "NT2",  gender: "M", pwd: true, prefix: "PWDR" },
  { label: "PWD common NT-D",       category: "NT3",  gender: "M", pwd: true, prefix: "PWDR" },
  // ── Defence (DEF) ────────────────────────────────────────────────────────
  { label: "Defence open",          category: null,   gender: "M", defence: true, prefix: "DEF" },
  { label: "Defence OBC",           category: "OBC",  gender: "M", defence: true, prefix: "DEF" },
  { label: "Defence SEBC",          category: "SEBC", gender: "M", defence: true, prefix: "DEF" },
  { label: "Defence SC",            category: "SC",   gender: "M", defence: true, prefix: "DEF" },
  { label: "Defence ST",            category: "ST",   gender: "M", defence: true, prefix: "DEF" },
  { label: "Defence VJ/DT",         category: "VJ",   gender: "M", defence: true, prefix: "DEF" },
  { label: "Defence NT-B",          category: "NT1",  gender: "M", defence: true, prefix: "DEF" },
  { label: "Defence NT-C",          category: "NT2",  gender: "M", defence: true, prefix: "DEF" },
  { label: "Defence NT-D",          category: "NT3",  gender: "M", defence: true, prefix: "DEF" },
  // ── DEFR (Defence common reserved) ────────────────────────────────────────
  { label: "Defence common OBC",    category: "OBC",  gender: "M", defence: true, prefix: "DEFR" },
  { label: "Defence common SEBC",   category: "SEBC", gender: "M", defence: true, prefix: "DEFR" },
  { label: "Defence common SC",     category: "SC",   gender: "M", defence: true, prefix: "DEFR" },
  { label: "Defence common ST",     category: "ST",   gender: "M", defence: true, prefix: "DEFR" },
  { label: "Defence common VJ/DT",  category: "VJ",   gender: "M", defence: true, prefix: "DEFR" },
  { label: "Defence common NT-B",   category: "NT1",  gender: "M", defence: true, prefix: "DEFR" },
  { label: "Defence common NT-C",   category: "NT2",  gender: "M", defence: true, prefix: "DEFR" },
  { label: "Defence common NT-D",   category: "NT3",  gender: "M", defence: true, prefix: "DEFR" },
  // ── Special / standalone ─────────────────────────────────────────────────
  { label: "EWS",                   category: null,   gender: "M", ews: true },
  { label: "TFWS",                  category: null,   gender: "M", tfws: true },
  { label: "Orphan",                category: null,   gender: "M", orphan: true },
];

function isGroup(v: string | null): v is BranchGroup {
  return !!v && (BRANCH_GROUPS as readonly string[]).includes(v);
}

/**
 * Journey J3, "Where can I study Computer Engineering?": one row per college offering a
 * branch group, with Round I and last-round closing ranks against the student's merit.
 */
export function BranchesPage() {
  const { profile } = useProfile();
  const [params, setParams] = useSearchParams();
  const selectedBranch = params.get("branch") ?? null;
  const group: BranchGroup | null = selectedBranch
    ? null
    : isGroup(params.get("group"))
      ? (params.get("group") as BranchGroup)
      : BRANCH_GROUPS[0];

  const [results, setResults] = useState<FindOption[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const merit = profile.meritNumber;

  // Every branch's open, state-level latest-round closing rank, by branch group, for the group cards
  const [groupVals, setGroupVals] = useState<Map<string, number[]> | null>(null);
  useEffect(() => {
    let live = true;
    api
      .openLatest()
      .then((r) => {
        if (!live) return;
        const m = new Map<string, number[]>();
        for (const row of r.rows) if (row[5]) m.set(row[5], [...(m.get(row[5]) ?? []), row[4]]);
        setGroupVals(m);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const groupDomain = useMemo(() => logBounds(groupVals ? [...groupVals.values()].flat() : []), [groupVals]);
  const [selectedFilterIdx, setSelectedFilterIdx] = useState<number>(() => {
    const cat = profile.category ?? "";
    const gender = profile.gender;
    const idx = SEAT_FILTERS.findIndex((f) => f.category === (cat || null) && f.gender === gender && !f.ews && !f.tfws && !f.defence && !f.pwd);
    return idx >= 0 ? idx : 0;
  });
  const seatFilter = SEAT_FILTERS[selectedFilterIdx];

  // Branch combobox
  const [allBranches, setAllBranches] = useState<string[]>([]);
  const [comboLoading, setComboLoading] = useState(true);
  const [comboQuery, setComboQuery] = useState(selectedBranch ?? "");
  const [comboOpen, setComboOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const comboRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Prevents the URL-sync effect from wiping the input when the user types (which itself clears the URL param).
  const suppressSyncRef = useRef(false);

  useEffect(() => {
    api
      .branches()
      .then((r) => { setAllBranches(r.branches); setComboLoading(false); })
      .catch(() => setComboLoading(false));
  }, []);

  // Sync input when selectedBranch changes externally (e.g. browser back/forward).
  useEffect(() => {
    if (suppressSyncRef.current) { suppressSyncRef.current = false; return; }
    setComboQuery(selectedBranch ?? "");
  }, [selectedBranch]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const filteredBranches = useMemo(
    () =>
      allBranches
        .filter((b) => b.toLowerCase().includes(comboQuery.toLowerCase()))
        .slice(0, 60),
    [allBranches, comboQuery],
  );

  const selectBranch = (b: string) => {
    setComboQuery(b);
    setComboOpen(false);
    setParams({ branch: b }, { replace: true });
  };

  const clearBranch = () => {
    setComboQuery("");
    setComboOpen(false);
    setParams({ group: group ?? BRANCH_GROUPS[0] }, { replace: true });
    inputRef.current?.focus();
  };

  const onComboKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!comboOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setComboOpen(true);
        setHighlighted(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      setHighlighted((h) => Math.min(h + 1, filteredBranches.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlighted((h) => Math.max(h - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      const pick = filteredBranches[highlighted];
      if (pick) selectBranch(pick);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setComboOpen(false);
      if (!selectedBranch) setComboQuery("");
    }
  };

  useEffect(() => {
    let live = true;
    setStatus("loading");
    api
      .find({
        merit: merit ?? 1,
        homeUniversity: profile.homeUniversity || null,
        category: seatFilter.category,
        gender: seatFilter.gender,
        minorityCommunity: profile.minorityCommunity,
        flags: { ews: !!seatFilter.ews, tfws: !!seatFilter.tfws, defence: !!seatFilter.defence, pwd: !!seatFilter.pwd, orphan: !!seatFilter.orphan },
        subjectGroup: profile.subjectGroup,
        filters: { branchGroup: group, branch: selectedBranch },
      })
      .then((r) => {
        if (!live) return;
        setResults([...r.options].sort((a, b) => (a.firstRoundClosing ?? a.closingMerit) - (b.firstRoundClosing ?? b.closingMerit)));
        setStatus("done");
      })
      .catch(() => live && setStatus("error"));
    return () => {
      live = false;
    };
  }, [group, selectedBranch, merit, profile, seatFilter, retry]);

  const displayed = useMemo(() => {
    const p = seatFilter.prefix;
    if (!p) return results;
    // "PWD" should not include "PWDR"; "DEF" should not include "DEFR"; "L" is exact prefix.
    if (p === "PWD" || p === "DEF") return results.filter((r) => r.seatType.startsWith(p) && !r.seatType.startsWith(p + "R"));
    return results.filter((r) => r.seatType.startsWith(p));
  }, [results, seatFilter]);

  const domain = useMemo(
    () => ladderDomain(displayed.flatMap((r) => [r.firstRoundClosing ?? r.closingMerit, r.lastRoundClosing ?? r.closingMerit, ...(merit ? [merit] : [])])),
    [displayed, merit],
  );
  const reachable = merit ? displayed.filter((r) => r.status !== "out-of-range").length : null;
  const activeLabel = selectedBranch ?? group ?? "";

  return (
    <div className="page branches-page">
      <PageHeader
        title="By branch"
        subtitle={
          merit
            ? `Every college offering a branch, with where it closed in Round I and in the last round, against your merit ${formatNumber(merit)}.`
            : "Every college offering a branch, with where it closed in Round I and in the last round."
        }
        actions={
          !merit && (
            <Link to="/profile" className="btn btn-secondary btn-sm">
              <Icon name="user" size={16} />
              Add your merit number
            </Link>
          )
        }
      />

      <div className="branches-filter-row">
        <div className="branches-groups" role="group" aria-label="Branch group">
          {BRANCH_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className={`branches-group${g === group ? " active" : ""}`}
              aria-pressed={g === group}
              onClick={() => {
                setComboQuery("");
                setComboOpen(false);
                setParams({ group: g }, { replace: true });
              }}
            >
              <span className="branches-group-name">{g}</span>
              {groupVals && (
                <>
                  <GroupBarcode vals={groupVals.get(g) ?? []} merit={merit ?? null} domain={groupDomain} active={g === group} />
                  <span className="branches-group-count">
                    {merit
                      ? `${formatNumber((groupVals.get(g) ?? []).filter((v) => merit <= v).length)} of ${formatNumber((groupVals.get(g) ?? []).length)} within reach on open seats`
                      : `${formatNumber((groupVals.get(g) ?? []).length)} branches`}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>

        <div className="branches-combo" ref={comboRef}>
          <div className="branches-combo-wrap">
            <input
              ref={inputRef}
              id="branch-search"
              type="text"
              role="combobox"
              aria-expanded={comboOpen}
              aria-autocomplete="list"
              aria-controls="branch-combo-list"
              aria-label="Search a specific branch"
              className={`branches-combo-input${selectedBranch ? " has-value" : ""}`}
              placeholder="Search branch…"
              value={comboQuery}
              autoComplete="off"
              onChange={(e) => {
                setComboQuery(e.target.value);
                setComboOpen(true);
                setHighlighted(0);
                if (selectedBranch) {
                  suppressSyncRef.current = true;
                  setParams({ group: group ?? BRANCH_GROUPS[0] }, { replace: true });
                }
              }}
              onFocus={() => {
                setComboOpen(true);
                setHighlighted(0);
              }}
              onKeyDown={onComboKeyDown}
            />
            {comboQuery ? (
              <button
                type="button"
                className="branches-combo-clear"
                aria-label="Clear branch filter"
                tabIndex={-1}
                onClick={clearBranch}
              >
                ×
              </button>
            ) : (
              <span className="branches-combo-icon" aria-hidden="true">
                <Icon name="search" size={14} />
              </span>
            )}
          </div>
          {comboOpen && (
            <ul
              id="branch-combo-list"
              role="listbox"
              aria-label="Branches"
              className="branches-combo-list"
            >
              {comboLoading ? (
                <li className="branches-combo-hint">Loading branches…</li>
              ) : filteredBranches.length === 0 ? (
                <li className="branches-combo-hint">No branches match</li>
              ) : (
                filteredBranches.map((b, i) => (
                  <li
                    key={b}
                    role="option"
                    aria-selected={b === selectedBranch}
                    className={`branches-combo-item${i === highlighted ? " highlighted" : ""}${b === selectedBranch ? " selected" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectBranch(b);
                    }}
                    onMouseEnter={() => setHighlighted(i)}
                  >
                    {b}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <select
          className="branches-cat-select"
          value={selectedFilterIdx}
          onChange={(e) => setSelectedFilterIdx(Number(e.target.value))}
          aria-label="Reservation category"
        >
          {SEAT_FILTERS.map((f, i) => (
            <option key={i} value={i}>{f.label}</option>
          ))}
        </select>
      </div>

      {status === "error" ? (
        <div className="empty-state" role="alert">
          <h2>Couldn't load branches</h2>
          <p>Check your connection and try again.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : status === "done" && displayed.length === 0 ? (
        <div className="empty-state">
          <h2>No colleges offer {activeLabel} in this data</h2>
          <p>Try another branch or category.</p>
        </div>
      ) : (
        <section className="card branches-table" aria-labelledby="branches-title" aria-busy={status === "loading"}>
          <div className="branches-table-head">
            <h2 id="branches-title">
              {activeLabel}: {status === "loading" ? "loading…" : `${displayed.length} ${displayed.length === 1 ? "college" : "colleges"}`}
              {reachable != null && status === "done" && <span className="branches-reach"> · {reachable} within reach for you</span>}
            </h2>
            <LadderLegend showYou={!!merit} />
          </div>
          <ul className="branches-rows">
            {displayed.map((o) => (
              <li key={o.choiceCode} className="branches-row">
                <div className="branches-row-name">
                  <Link to={`/colleges/${o.collegeCode}`} className="branches-college">{o.collegeName}</Link>
                  <span className="branches-branch">{o.branch}</span>
                  <span className="branches-meta">
                    <abbr title={seatTypeLabel(o.seatType)}>{seatTypeShortLabel(o.seatType)}</abbr>
                    {" · "}Round I {o.firstRoundClosing != null ? formatNumber(o.firstRoundClosing) : "—"}
                    {" → last "}{o.lastRoundClosing != null ? formatNumber(o.lastRoundClosing) : "—"}
                  </span>
                </div>
                <div className="branches-row-ladder">
                  <MeritLadder first={o.firstRoundClosing ?? null} last={o.lastRoundClosing ?? null} you={merit} domain={domain} label={`${o.collegeName}, ${o.branch}`} />
                </div>
                <div className="branches-row-status">{merit ? <StatusBadge status={o.status} round={o.round} /> : null}</div>
                <AddToFormButton item={listItemFrom(o)} />
              </li>
            ))}
          </ul>
          {results.length > 0 && (
            <div className="branches-axis">
              <span />
              <LadderAxis domain={domain} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
