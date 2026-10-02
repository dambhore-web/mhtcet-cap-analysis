import { useMemo } from "react";
import { Link } from "react-router-dom";
import { eligibleSeatTypes, type CandidateProfile } from "@mhtcet/core";
import { PageHeader } from "../components/PageHeader";
import { NextStepCard } from "../components/NextStepCard";
import { AccountPanel } from "../components/AccountPanel";
import { Icon } from "../components/Icon";
import { useProfile } from "../lib/ProfileContext";
import { useAuth } from "../lib/AuthContext";
import { useList, OPTION_FORM_MAX } from "../lib/list";
import { useAllotment } from "../lib/allotment";
import { syncMeta } from "../lib/storage";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { formatNumber, formatRound } from "../lib/format";
import { seatTypeLabel } from "../lib/seatType";
import { CAP_CALENDAR } from "../data/capCalendar";
import { formatSpan, timeline, todayInIndia } from "../lib/capCalendar";
import "./AccountPage.css";

const FLAG_LABELS: [keyof CandidateProfile & ("ews" | "tfws" | "defence" | "pwd" | "orphan"), string][] = [
  ["ews", "EWS"], ["tfws", "TFWS"], ["defence", "Defence"], ["pwd", "PWD"], ["orphan", "Orphan"],
];

function formatEdited(iso: string | undefined): string | null {
  if (!iso || iso.startsWith("1970")) return null;
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * My account (#139): where the student left off. Your numbers, what to do next, the option form
 * and the CAP timeline, from what this browser (and, signed in, the account) knows.
 */
export function AccountPage() {
  const { profile, hasProfile } = useProfile();
  const { user } = useAuth();
  const items = useList();
  const allotment = useAllotment();
  const edited = formatEdited(syncMeta().list);

  const seatCodes = useMemo(() => {
    const candidate: CandidateProfile = {
      candidature: "MH",
      homeUniversity: profile.homeUniversity || null,
      category: profile.category === "OPEN" ? null : profile.category,
      gender: profile.gender,
      ews: profile.ews, tfws: profile.tfws, defence: profile.defence, pwd: profile.pwd, orphan: profile.orphan,
      minorityCommunity: profile.minorityCommunity,
      meritNumber: 1,
      subjectGroup: profile.subjectGroup,
    };
    return eligibleSeatTypes(candidate, { homeUniversity: profile.homeUniversity || null, minorityCommunity: null });
  }, [profile]);

  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === (profile.category ?? ""))?.label ?? "Open";
  const flags = FLAG_LABELS.filter(([k]) => profile[k]).map(([, l]) => l);
  const rows = timeline(CAP_CALENDAR.events, todayInIndia());
  const allottedItem = allotment ? items.find((i) => i.choiceCode === allotment.choiceCode) : undefined;

  return (
    <div className="page account-page">
      <PageHeader
        title="My account"
        subtitle={user ? `Signed in as ${user.email}. Your details and option form follow you to any device.` : "Saved on this device only. Sign in to use it on your phone and computer."}
      />

      <NextStepCard />

      <div className="account-grid">
        <section className="card account-card" aria-labelledby="acc-numbers">
          <div className="account-card-head">
            <h2 id="acc-numbers">Your numbers</h2>
            <Link to="/profile/details" className="account-edit">Edit details</Link>
          </div>
          {profile.meritNumber ? (
            <p className="account-merit">
              <span className="num-xl">{formatNumber(profile.meritNumber)}</span>
              <span className="account-merit-label">state merit number</span>
            </p>
          ) : (
            <p className="account-merit-missing">
              No merit number yet. <Link to="/estimate">Estimate it from your percentile</Link> or <Link to="/profile/details">add it</Link>.
            </p>
          )}
          {hasProfile && (
            <dl className="account-facts">
              <div><dt>Category</dt><dd>{categoryLabel}{profile.gender === "F" ? " · Female" : ""}</dd></div>
              <div><dt>Home university</dt><dd>{profile.homeUniversity || "Not set"}</dd></div>
              {flags.length > 0 && <div><dt>Special seats</dt><dd>{flags.join(", ")}</dd></div>}
              <div>
                <dt>Seat types</dt>
                <dd>
                  {seatCodes.length} you can take ·{" "}
                  {seatCodes.slice(0, 4).map((c, i) => (
                    <span key={c}>{i > 0 && ", "}<abbr title={seatTypeLabel(c)} className="mono">{c}</abbr></span>
                  ))}
                  {seatCodes.length > 4 && "…"}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className="card account-card" aria-labelledby="acc-form">
          <div className="account-card-head">
            <h2 id="acc-form">Your option form</h2>
            {edited && <span className="account-edited">Edited {edited}</span>}
          </div>
          {items.length === 0 ? (
            <p className="account-empty">
              No choices yet. <Link to="/find">Find colleges</Link> and tap + to add them.
            </p>
          ) : (
            <>
              <p className="account-count">
                <span className="num-l">{items.length}</span> of {OPTION_FORM_MAX} choices
              </p>
              <ol className="account-top">
                {items.slice(0, 5).map((it) => (
                  <li key={it.id}>
                    <span className="account-top-college">{it.collegeName}</span>
                    <span className="account-top-branch">{it.branch}</span>
                  </li>
                ))}
              </ol>
              {items.length > 5 && <p className="account-more">and {items.length - 5} more</p>}
            </>
          )}
          {allotment && (
            <p className="account-allotted">
              <Icon name="check" size={14} />
              <span>
                Allotted in {formatRound(allotment.round)}{allottedItem ? `: ${allottedItem.collegeName}, ${allottedItem.branch}` : ""}.{" "}
                <Link to="/allotment">Freeze, float or slide?</Link>
              </span>
            </p>
          )}
          <div className="account-links">
            <Link to="/list" className="btn btn-secondary btn-sm">Option form</Link>
            <Link to="/simulator" className="btn btn-ghost btn-sm">Simulator</Link>
            <Link to="/export" className="btn btn-ghost btn-sm">Export</Link>
          </div>
        </section>
      </div>

      {rows.length > 0 && (
        <section className="card account-card account-timeline" aria-labelledby="acc-cal">
          <div className="account-card-head">
            <h2 id="acc-cal">CAP {CAP_CALENDAR.year} dates</h2>
          </div>
          <ol className="cal-list">
            {rows.map(({ event, state }) => (
              <li key={event.id} className={`cal-row cal-row--${state}`} aria-current={state === "current" ? "step" : undefined}>
                <span className="cal-date mono">{formatSpan(event.start, event.end)}</span>
                <span className="cal-label">
                  {event.label}
                  {event.provisional && <span className="badge badge-sample">Provisional</span>}
                </span>
                <a className="cal-source" href={event.sourceUrl} target="_blank" rel="noreferrer">
                  {event.sourceTitle} · checked {formatSpan(event.checkedOn)}
                </a>
              </li>
            ))}
          </ol>
          <p className="account-note-small">From CET Cell notices. Dates can change: check the notice before a deadline.</p>
        </section>
      )}

      <AccountPanel />
    </div>
  );
}
