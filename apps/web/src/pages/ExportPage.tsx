import { useState } from "react";
import { Link } from "react-router-dom";
import { loadList, type ListItem } from "../lib/list";
import { useProfile } from "../lib/ProfileContext";
import "./ExportPage.css";

function exportCSV(items: ListItem[], merit: number) {
  const header = ["Rank", "Choice Code", "College", "Branch", "Seat Type", "Closing Merit 2026", "Your Surplus"];
  const rows = items.map((item, i) => [
    String(i + 1),
    item.choiceCode,
    item.collegeName,
    item.branch,
    item.seatType,
    String(item.closingMerit),
    String(item.closingMerit - merit),
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "compass-preference-list.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPDF(items: ListItem[], merit: number, category: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MHT-CET 2026 Preference List", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Merit: ${merit.toLocaleString("en-IN")}  ·  Category: ${category || "Open"}  ·  Generated: ${new Date().toLocaleDateString("en-IN")}`,
    14,
    26,
  );
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Compass · compass.mhtcet.in · Based on official DTE Maharashtra 2026 CAP cutoffs. Not a guarantee.",
    14,
    32,
  );
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 36,
    head: [["#", "Choice Code", "College", "Branch", "Seat Type", "Closing Merit", "Surplus"]],
    body: items.map((item, i) => {
      const surplus = item.closingMerit - merit;
      return [
        String(i + 1),
        item.choiceCode,
        item.collegeName,
        item.branch,
        item.seatType,
        item.closingMerit.toLocaleString("en-IN"),
        surplus >= 0 ? `+${surplus.toLocaleString("en-IN")}` : surplus.toLocaleString("en-IN"),
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 27, 51] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 28, font: "courier" },
      2: { cellWidth: 70 },
      3: { cellWidth: 55 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
    },
    alternateRowStyles: { fillColor: [247, 248, 250] },
  });

  doc.save("compass-preference-list.pdf");
}

export function ExportPage() {
  const { profile } = useProfile();
  const [items] = useState<ListItem[]>(() => loadList());
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const merit = profile.meritNumber ?? 0;
  const category = profile.category ?? "";

  async function handleCopy() {
    const codes = items.map((i) => i.choiceCode).join("\n");
    await navigator.clipboard.writeText(codes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handlePDF() {
    setPdfLoading(true);
    try {
      await exportPDF(items, merit, category);
    } finally {
      setPdfLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="export-page">
        <div className="export-content">
          <div className="export-empty">
            <div className="export-empty-icon">↓</div>
            <h2>Nothing to export yet</h2>
            <p>Build your shortlist first, then come back here to download it.</p>
            <Link to="/list" className="export-empty-cta">Go to shortlist →</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="export-page">
      <div className="export-content">

        <header className="export-header">
          <div>
            <h1>Export option form</h1>
            <p className="export-sub">
              {items.length} option{items.length !== 1 ? "s" : ""}
              {merit > 0 && <> · Merit <strong>{merit.toLocaleString("en-IN")}</strong></>}
              {category && <> · <span className="export-cat">{category}</span></>}
            </p>
          </div>
          <Link to="/list" className="export-edit-link">Edit list →</Link>
        </header>

        {/* Format cards */}
        <div className="export-formats">

          <div className="export-format-card">
            <div className="export-format-icon export-format-icon-pdf">PDF</div>
            <div className="export-format-body">
              <h3>PDF — print or carry</h3>
              <p>Landscape A4, one row per option with your surplus highlighted. Ready to print and bring to the CAP reporting centre.</p>
            </div>
            <button
              className="export-format-btn export-format-btn-primary"
              onClick={handlePDF}
              disabled={pdfLoading}
            >
              {pdfLoading ? "Generating…" : "Download PDF"}
            </button>
          </div>

          <div className="export-format-card">
            <div className="export-format-icon export-format-icon-csv">CSV</div>
            <div className="export-format-body">
              <h3>CSV — open in Excel / Sheets</h3>
              <p>Comma-separated with BOM for Excel. All columns: rank, choice code, college, branch, seat type, closing merit, surplus.</p>
            </div>
            <button
              className="export-format-btn"
              onClick={() => exportCSV(items, merit)}
            >
              Download CSV
            </button>
          </div>

          <div className="export-format-card">
            <div className="export-format-icon export-format-icon-copy">#</div>
            <div className="export-format-body">
              <h3>Copy choice codes</h3>
              <p>One code per line, in your preferred order. Paste directly into the CAP online form.</p>
            </div>
            <button
              className={`export-format-btn${copied ? " export-format-btn-done" : ""}`}
              onClick={handleCopy}
            >
              {copied ? "Copied ✓" : "Copy codes"}
            </button>
          </div>

        </div>

        {/* Preview table */}
        <div className="export-preview">
          <div className="export-preview-head">
            <span className="exp-col-rank">#</span>
            <span className="exp-col-code">Choice code</span>
            <span className="exp-col-detail">College / Branch</span>
            <span className="exp-col-seat">Seat</span>
            <span className="exp-col-merit">Closing / Surplus</span>
          </div>
          <div className="export-preview-rows">
            {items.map((item, i) => {
              const surplus = merit > 0 ? item.closingMerit - merit : null;
              return (
                <div key={item.id} className="export-preview-row">
                  <span className="exp-col-rank exp-rank-num">{i + 1}</span>
                  <span className="exp-col-code exp-code-tag">{item.choiceCode}</span>
                  <div className="exp-col-detail">
                    <span className="exp-college">{item.collegeName}</span>
                    <span className="exp-branch">{item.branch}</span>
                  </div>
                  <span className="exp-col-seat exp-seat-tag">{item.seatType}</span>
                  <div className="exp-col-merit exp-merit-col">
                    <span className="exp-closing">{item.closingMerit.toLocaleString("en-IN")}</span>
                    {surplus !== null && (
                      <span className={`exp-surplus${surplus >= 0 ? " pos" : " neg"}`}>
                        {surplus >= 0 ? `+${surplus.toLocaleString("en-IN")}` : surplus.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="export-preview-foot">
            {items.length}/300 options · 2026 closing merits from official DTE Maharashtra lists
          </div>
        </div>

      </div>
    </div>
  );
}
