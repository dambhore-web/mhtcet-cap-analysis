import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type CollegeFees } from "../lib/api";
import { useList } from "../lib/list";
import { useProfile } from "../lib/ProfileContext";
import { analyseAllotment, useAllotment, type Advice } from "../lib/allotment";
import { buildSummary, decodeSummary, encodeSummary, type Summary } from "../lib/summary";
import { PageHeader } from "../components/PageHeader";
import { PlanSubnav } from "../components/PlanSubnav";
import { Icon } from "../components/Icon";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { formatNumber, formatRound } from "../lib/format";
import { formatInr } from "../lib/plans";
import { seatTypeShortLabel } from "../lib/seatType";
import "./SummaryPage.css";

const PLAN_WORD: Record<Advice, string> = {
  frozen: "Accept and report (seat auto-frozen)",
  final: "Accept and report (final round)",
  freeze: "Freeze",
  float: "Float",
  slide: "Slide",
};

function categoryLabel(v: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === v)?.label ?? "Open";
}

/** My CAP plan step 5, journeys J10 and J11: one page a parent can read from a shared link. */
export function SummaryPage() {
  const [params] = useSearchParams();
  const shared = useMemo(() => decodeSummary(params.get("p")), [params]);
  const badLink = params.has("p") && !shared;
  const { profile } = useProfile();
  const items = useList();
  const allotment = useAllotment();

  const own = useMemo(() => {
    const a = allotment ? analyseAllotment(items, allotment, profile.meritNumber) : null;
    return buildSummary({
      merit: profile.meritNumber,
      category: profile.category ?? "",
      gender: profile.gender,
      items,
      allotment: a && allotment ? { round: allotment.round, preference: a.preference, advice: a.advice } : null,
    });
  }, [items, allotment, profile]);

  const s: Summary = shared ?? own;
  const allotted = s.allotment ? s.choices[s.allotment.preference - 1] : null;
  const link = `${window.location.origin}/summary?p=${encodeSummary(own)}`;
  const [copied, setCopied] = useState(false);
  const [fees, setFees] = useState<CollegeFees | null>(null);

  useEffect(() => {
    const code = allotted?.collegeCode;
    setFees(null);
    if (!code) return;
    api.collegeFees(code).then((f) => setFees(f.available ? f : null)).catch(() => setFees(null));
  }, [allotted?.collegeCode]);

  // Among the choices above the seat, the one that opened with the smallest margin last year
  const tightest = useMemo(() => {
    if (!s.allotment || !s.merit) return null;
    const above = s.choices.slice(0, s.allotment.preference - 1).filter((c) => s.merit! <= c.lastRoundClosing);
    return above.sort((a, b) => a.lastRoundClosing - b.lastRoundClosing)[0] ?? null;
  }, [s]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* the link is shown on screen */
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Our MHT-CET CAP plan: ${link}`)}`;

  return (
    <div className="page page--narrow summary-page">
      {shared ? (
        <PageHeader title="Family summary" subtitle={`A CAP plan shared with you, prepared ${s.preparedOn}.`} />
      ) : (
        <>
          <PageHeader
            breadcrumb={[{ label: "My CAP plan", to: "/list" }, { label: "Family summary" }]}
            title="Family summary"
            subtitle="One page for your family: where things stand, the plan, the risks and the costs. The link contains no name or application ID."
            actions={
              items.length > 0 && (
                <>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
                    <Icon name={copied ? "check" : "share"} size={16} />
                    {copied ? "Link copied" : "Copy link"}
                  </button>
                  <a className="btn btn-secondary btn-sm" href={whatsapp} target="_blank" rel="noreferrer">Share on WhatsApp</a>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                    Print or save as PDF
                  </button>
                </>
              )
            }
          />
          <PlanSubnav />
        </>
      )}

      {badLink && (
        <div className="empty-state" role="alert">
          <h2>This summary link is broken</h2>
          <p>Ask for the link to be shared again.</p>
        </div>
      )}

      {!badLink && s.choices.length === 0 ? (
        <div className="empty-state">
          <Icon name="clipboard" size={28} className="empty-state-icon" />
          <h2>Nothing to summarise yet</h2>
          <p>Add choices to your option form. Once your Round I allotment is out, record it on the After allotment step.</p>
          <Link to="/list" className="btn btn-primary">Go to option form</Link>
        </div>
      ) : !badLink ? (
        <article className="card summary-sheet">
          <header className="summary-head">
            <span className="summary-brand"><Icon name="compass" size={18} /> Compass · Family summary</span>
            <span className="summary-facts">
              {s.merit ? `Merit ${formatNumber(s.merit)}` : "Merit not entered"} · {categoryLabel(s.category)} · {s.gender === "F" ? "Female" : "Male"}
            </span>
          </header>

          <section>
            <h2>Where things stand</h2>
            {allotted && s.allotment ? (
              <p>
                Allotted <strong>{allotted.branch}</strong> at <strong>{allotted.collegeName}</strong> in {formatRound(s.allotment.round)} (choice{" "}
                {s.allotment.preference}). The plan is to <strong>{PLAN_WORD[s.allotment.advice]}</strong>.
              </p>
            ) : (
              <p>No allotment yet. The option form below is ready for the CAP portal.</p>
            )}
          </section>

          <section>
            <h2>Option form, top {s.choices.length}</h2>
            <ol className="summary-choices">
              {s.choices.map((c, i) => (
                <li key={c.choiceCode} className={s.allotment?.preference === i + 1 ? "current" : ""}>
                  <span className="summary-pref">{i + 1}</span>
                  <span className="summary-choice">
                    <strong>{c.collegeName}</strong>
                    <span>{c.branch} · {seatTypeShortLabel(c.seatType)} · {c.choiceCode}</span>
                  </span>
                  <span className="summary-rank">
                    {c.firstRoundClosing != null ? `${formatNumber(c.firstRoundClosing)} → ` : ""}
                    {formatNumber(c.lastRoundClosing)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="summary-note">Closing ranks last year, Round I → last round.</p>
          </section>

          <section>
            <h2>Risks to keep in mind</h2>
            <ul>
              {tightest && s.merit ? (
                <li>
                  {tightest.branch} at {tightest.collegeName} reached merit {formatNumber(s.merit)} by only {formatNumber(tightest.lastRoundClosing - s.merit)} places last year. If this year is tighter, the seat may not move up.
                </li>
              ) : null}
              <li>Past cutoffs describe what happened last year and are not a guarantee of admission.</li>
            </ul>
          </section>

          <section>
            <h2>Costs</h2>
            <ul>
              <li>Seat acceptance fee: as shown on the CET Cell portal for this round.</li>
              {fees ? (
                <li>
                  Annual fee at {allotted?.collegeName}: {formatInr(fees.fees.totalAnnualFee)} ({fees.year}, Fee Regulating Authority).
                  {fees.tfwsAvailable ? " TFWS seats pay no tuition." : ""}
                </li>
              ) : allotted ? (
                <li>Annual fee at {allotted.collegeName}: not published in Compass yet. Check the college's FRA fee order.</li>
              ) : null}
            </ul>
          </section>

          <section>
            <h2>Next dates</h2>
            <p>Seat acceptance, reporting and the next round's option form dates are on the CET Cell portal. Check them the day an allotment is published.</p>
          </section>

          <footer className="summary-foot">
            Figures come from the official CAP cutoff lists published by the State CET Cell. Compass is an unofficial guide.
          </footer>
        </article>
      ) : null}

      {shared && (
        <p className="summary-own">
          <Link to="/">Make your own plan with Compass</Link>
        </p>
      )}
    </div>
  );
}
