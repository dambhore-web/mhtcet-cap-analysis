import type { ListItem } from "./list";
import { seatTypeLabel } from "./seatType";
import { describeMeritGap } from "./meritGap";

/**
 * Exports of the option form (journey J8): CSV, Excel, PDF and a plain list of choice codes.
 * One row per choice, in the order the student will enter them on the CET Cell portal.
 */

export const EXPORT_HEADER = ["Preference", "Choice code", "College", "Branch", "Seat type", "Seat type (meaning)", "Closing rank", "Your merit vs closing"] as const;

export type ExportRow = [number, string, string, string, string, string, number, string | null];

export function exportRows(items: ListItem[], merit: number | null): ExportRow[] {
  return items.map((it, i) => [
    i + 1,
    it.choiceCode,
    it.collegeName,
    it.branch,
    it.seatType,
    seatTypeLabel(it.seatType),
    it.closingMerit,
    // "1,000 better" / "1,000 worse" (#140): a smaller merit number is better
    merit ? describeMeritGap(merit, it.closingMerit).short : null,
  ]);
}

export function toCSV(items: ListItem[], merit: number | null): string {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [EXPORT_HEADER as readonly string[], ...exportRows(items, merit)].map((r) => r.map(esc).join(",")).join("\r\n");
}

export function choiceCodesText(items: ListItem[]): string {
  return items.map((i) => i.choiceCode).join("\n");
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(items: ListItem[], merit: number | null) {
  // BOM so Excel opens UTF-8 correctly
  download(new Blob(["﻿" + toCSV(items, merit)], { type: "text/csv;charset=utf-8" }), "compass-option-form.csv");
}

export async function downloadXLSX(items: ListItem[], merit: number | null) {
  const { default: writeXlsxFile } = await import("write-excel-file");
  const header = EXPORT_HEADER.map((value) => ({ value, fontWeight: "bold" as const }));
  const body = exportRows(items, merit).map((r) =>
    r.map((v) => (v === null ? null : typeof v === "number" ? { type: Number, value: v } : { type: String, value: v })),
  );
  const blob = await writeXlsxFile([header, ...body], {
    columns: [{ width: 11 }, { width: 14 }, { width: 48 }, { width: 38 }, { width: 11 }, { width: 36 }, { width: 13 }, { width: 22 }],
    sheet: "Option form",
    stickyRowsCount: 1,
  });
  download(blob, "compass-option-form.xlsx");
}

export async function downloadPDF(items: ListItem[], merit: number | null, categoryLabel: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MHT-CET CAP option form", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    [merit ? `Merit ${merit.toLocaleString("en-IN")}` : null, `Category ${categoryLabel}`, `Prepared ${new Date().toLocaleDateString("en-IN")}`]
      .filter(Boolean)
      .join("  ·  "),
    14,
    26,
  );
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 120);
  doc.text("Enter these choice codes in this order on the CET Cell portal. Closing ranks are last year's official values, not a guarantee.", 14, 32);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 36,
    head: [["#", "Choice code", "College", "Branch", "Seat type", "Closing rank", "Your merit vs closing"]],
    body: exportRows(items, merit).map((r) => [
      String(r[0]), r[1], r[2], r[3], r[4], r[6].toLocaleString("en-IN"),
      r[7] ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [101, 82, 216] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 26, font: "courier" },
      2: { cellWidth: 78 },
      3: { cellWidth: 62 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
    },
    alternateRowStyles: { fillColor: [246, 247, 255] },
  });
  doc.save("compass-option-form.pdf");
}
