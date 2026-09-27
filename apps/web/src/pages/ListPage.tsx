import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { loadList, saveList, removeFromList, type ListItem } from "../lib/list";
import { useProfile } from "../lib/ProfileContext";
import "./ListPage.css";

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
    26
  );
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Compass · compass.mhtcet.in · Based on official DTE Maharashtra 2026 CAP cutoffs. Not a guarantee.", 14, 32);
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
    headStyles: { fillColor: [101, 82, 216] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 28, font: "courier" },
      2: { cellWidth: 70 },
      3: { cellWidth: 55 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
    },
    alternateRowStyles: { fillColor: [246, 247, 255] },
  });

  doc.save("compass-preference-list.pdf");
}

function SortableRow({
  item,
  rank,
  merit,
  onRemove,
}: {
  item: ListItem;
  rank: number;
  merit: number;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const surplus = item.closingMerit - merit;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`list-row${isDragging ? " dragging" : ""}`}
    >
      <button className="drag-handle" {...attributes} {...listeners} aria-label="Drag to reorder">
        ⠿
      </button>
      <span className="list-rank">{rank}</span>
      <span className="list-code">{item.choiceCode}</span>
      <div className="list-detail">
        <span className="list-college">{item.collegeName}</span>
        <span className="list-branch">{item.branch}</span>
      </div>
      <span className="list-seat">{item.seatType}</span>
      <div className="list-merit-col">
        <span className="list-closing">{item.closingMerit.toLocaleString("en-IN")}</span>
        <span className={`list-surplus${surplus >= 0 ? " pos" : " neg"}`}>
          {surplus >= 0 ? `+${surplus.toLocaleString("en-IN")}` : surplus.toLocaleString("en-IN")}
        </span>
      </div>
      <button className="list-remove" onClick={() => onRemove(item.id)} aria-label="Remove">×</button>
    </div>
  );
}

export function ListPage() {
  const { profile } = useProfile();
  const [items, setItems] = useState<ListItem[]>(() => loadList());
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const merit = profile.meritNumber ?? 0;
  const category = profile.category ?? "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    saveList(reordered);
  }

  const handleRemove = useCallback((id: string) => {
    setItems(removeFromList(id));
  }, []);

  async function handleCopyCodes() {
    const codes = items.map((i) => i.choiceCode).join("\n");
    await navigator.clipboard.writeText(codes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handlePDF() {
    setPdfLoading(true);
    try {
      await exportPDF(items, merit, category);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="list-page">
      <header className="list-header">
        <div className="list-header-top">
          <div>
            <h1>My List</h1>
            <p>{items.length === 0 ? "No options saved yet" : `${items.length} option${items.length !== 1 ? "s" : ""}`}</p>
          </div>
          {items.length > 0 && (
            <div className="list-export-row">
              <button className="list-export-btn" onClick={() => exportCSV(items, merit)}>
                CSV
              </button>
              <button className="list-export-btn" onClick={handlePDF} disabled={pdfLoading}>
                {pdfLoading ? "…" : "PDF"}
              </button>
              <button className="list-copy-btn" onClick={handleCopyCodes} aria-live="polite">
                {copied ? "Copied ✓" : "Copy codes"}
              </button>
            </div>
          )}
        </div>
        {merit > 0 && (
          <div className="list-merit-bar">
            Your merit: <strong>{merit.toLocaleString("en-IN")}</strong>
            {category && <span className="list-cat-badge">{category}</span>}
          </div>
        )}
      </header>

      {items.length === 0 ? (
        <div className="list-empty">
          <div className="list-empty-icon">📋</div>
          <h2>Your list is empty</h2>
          <p>
            Go to the <strong>Find</strong> tab, search for options, and tap the{" "}
            <span className="list-add-hint">+</span> button to save them here.
          </p>
          <p className="list-empty-note">
            You can save up to 300 options, drag to reorder, and export as PDF or CSV — free.
          </p>
        </div>
      ) : (
        <>
          <div className="list-table-head">
            <span className="lth-rank">#</span>
            <span className="lth-code">Choice code</span>
            <span className="lth-detail">College / Branch</span>
            <span className="lth-seat">Seat</span>
            <span className="lth-merit">Closing / Surplus</span>
            <span className="lth-del" />
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="list-rows" role="list">
                {items.map((item, i) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    rank={i + 1}
                    merit={merit}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="list-footnote">
            Drag rows to reorder · {items.length}/300 options · 2026 closing merits from official DTE Maharashtra lists
          </div>
        </>
      )}
    </div>
  );
}
