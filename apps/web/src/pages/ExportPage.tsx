import { useState } from "react";
import { Link } from "react-router-dom";
import { useList } from "../lib/list";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { PlanNextStep, PlanSubnav } from "../components/PlanSubnav";
import { Icon } from "../components/Icon";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { formatNumber } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import { choiceCodesText, downloadCSV, downloadPDF, downloadXLSX } from "../lib/exportForm";
import "./ExportPage.css";

type Busy = "pdf" | "xlsx" | null;

/** My CAP plan step 3, journey J8: the option form ready for the CET Cell portal. */
export function ExportPage() {
  const { profile } = useProfile();
  const items = useList();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const merit = profile.meritNumber;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === (profile.category ?? ""))?.label ?? "Open";

  async function run(kind: Exclude<Busy, null>, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(choiceCodesText(items));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked: the codes are visible in the table below */
    }
  }

  return (
    <div className="page export-page">
      <PageHeader
        breadcrumb={[{ label: "My CAP plan", to: "/list" }, { label: "Export" }]}
        title="Export for the CAP portal"
        subtitle="Enter these choice codes in the same order on the official CET Cell portal. Compass does not submit your form."
      />
      <PlanSubnav />

      {items.length === 0 ? (
        <div className="empty-state">
          <Icon name="clipboard" size={28} className="empty-state-icon" />
          <h2>Nothing to export yet</h2>
          <p>Add choices to your option form first, then come back to download it.</p>
          <Link to="/list" className="btn btn-primary">Go to option form</Link>
        </div>
      ) : (
        <>
          <div className="export-actions">
            <button type="button" className="btn btn-primary" onClick={() => run("pdf", () => downloadPDF(items, merit, categoryLabel))} disabled={busy !== null}>
              <Icon name="clipboard" size={18} />
              {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => run("xlsx", () => downloadXLSX(items, merit))} disabled={busy !== null}>
              {busy === "xlsx" ? "Preparing Excel…" : "Download Excel"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => downloadCSV(items, merit)}>
              Download CSV
            </button>
            <button type="button" className="btn btn-secondary" onClick={copy}>
              <Icon name={copied ? "check" : "clipboard"} size={18} />
              {copied ? "Choice codes copied" : "Copy choice codes in order"}
            </button>
            <span role="status" className="sr-only">{copied ? "Choice codes copied" : ""}</span>
          </div>

          <section className="card export-preview" aria-labelledby="export-preview-title">
            <div className="export-preview-head">
              <h2 id="export-preview-title">Preview · {items.length} {items.length === 1 ? "choice" : "choices"}</h2>
              <span className="export-preview-meta">
                {merit ? `Merit ${formatNumber(merit)} · ` : ""}
                {categoryLabel}
              </span>
            </div>
            <div className="table-scroll">
              <table className="export-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Choice code</th>
                    <th scope="col">College and branch</th>
                    <th scope="col">Seat type</th>
                    <th scope="col" className="num">Closing rank</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.id}>
                      <td className="num">{i + 1}</td>
                      <td className="export-code">{it.choiceCode}</td>
                      <td>
                        <span className="export-college">{it.collegeName}</span>
                        <span className="export-branch">{it.branch}</span>
                      </td>
                      <td><abbr title={seatTypeLabel(it.seatType)}>{seatTypeShortLabel(it.seatType)}</abbr></td>
                      <td className="num">{formatNumber(it.closingMerit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="export-note">
            Before you submit: <Link to="/simulator">test this order in the simulator</Link>, and share the plan with your family using the{" "}
            <Link to="/summary">family summary</Link>.
          </p>
          <PlanNextStep current="/export" />
        </>
      )}
    </div>
  );
}
