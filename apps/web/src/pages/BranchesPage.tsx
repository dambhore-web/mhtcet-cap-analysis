import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, BRANCH_GROUPS, type FindOption } from "../lib/api";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import { AddToFormButton } from "../components/AddToFormButton";
import { listItemFrom } from "../lib/list";
import { LadderAxis, LadderLegend, MeritLadder, ladderDomain } from "../components/MeritLadder";
import { formatNumber } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import "./BranchesPage.css";

type BranchGroup = (typeof BRANCH_GROUPS)[number];
type Status = "loading" | "done" | "error";

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
  const group: BranchGroup = isGroup(params.get("group")) ? (params.get("group") as BranchGroup) : BRANCH_GROUPS[0];
  const [results, setResults] = useState<FindOption[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const merit = profile.meritNumber;

  useEffect(() => {
    let live = true;
    setStatus("loading");
    api
      .find({
        // without a merit number every branch is listed; statuses are hidden
        merit: merit ?? 1,
        homeUniversity: profile.homeUniversity || null,
        category: profile.category ?? null,
        gender: profile.gender,
        minorityCommunity: null,
        flags: { ews: profile.ews, tfws: profile.tfws, defence: profile.defence, pwd: profile.pwd, orphan: profile.orphan },
        subjectGroup: profile.subjectGroup,
        filters: { branchGroup: group },
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
  }, [group, merit, profile, retry]);

  const domain = useMemo(
    () => ladderDomain(results.flatMap((r) => [r.firstRoundClosing ?? r.closingMerit, r.lastRoundClosing ?? r.closingMerit, ...(merit ? [merit] : [])])),
    [results, merit],
  );
  const reachable = merit ? results.filter((r) => r.status !== "out-of-range").length : null;

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

      <div className="branches-groups" role="group" aria-label="Branch">
        {BRANCH_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            className={`branches-group${g === group ? " active" : ""}`}
            aria-pressed={g === group}
            onClick={() => setParams({ group: g }, { replace: true })}
          >
            {g}
          </button>
        ))}
      </div>

      {status === "error" ? (
        <div className="empty-state" role="alert">
          <h2>Couldn't load branches</h2>
          <p>Check your connection and try again.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : status === "done" && results.length === 0 ? (
        <div className="empty-state">
          <h2>No colleges offer {group} in this data</h2>
          <p>Try another branch.</p>
        </div>
      ) : (
        <section className="card branches-table" aria-labelledby="branches-title" aria-busy={status === "loading"}>
          <div className="branches-table-head">
            <h2 id="branches-title">
              {group}: {status === "loading" ? "loading…" : `${results.length} ${results.length === 1 ? "college" : "colleges"}`}
              {reachable != null && status === "done" && <span className="branches-reach"> · {reachable} within reach for you</span>}
            </h2>
            <LadderLegend showYou={!!merit} />
          </div>
          <ul className="branches-rows">
            {results.map((o) => (
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
