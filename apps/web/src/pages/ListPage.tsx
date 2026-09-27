import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
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
import { PageHeader } from "../components/PageHeader";
import { PlanSubnav } from "../components/PlanSubnav";
import { Icon } from "../components/Icon";
import { formatNumber } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import { CATEGORY_OPTIONS } from "../lib/categories";
import "./ListPage.css";

/** CAP lets a candidate fill up to 300 choice codes in the option form. */
const OPTION_FORM_MAX = 300;

function exportCSV(items: ListItem[], merit: number) {
  const header = ["Preference", "Choice code", "College", "Branch", "Seat type", "Closing rank", "Ranks to spare"];
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
  doc.text("MHT-CET CAP option form", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Merit: ${merit.toLocaleString("en-IN")}  ·  Category: ${category || "Open"}  ·  Generated: ${new Date().toLocaleDateString("en-IN")}`,
    14,
    26
  );
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Compass · Closing ranks from official CET Cell CAP lists. A guide, not a guarantee.", 14, 32);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 36,
    head: [["#", "Choice code", "College", "Branch", "Seat type", "Closing rank", "To spare"]],
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
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`list-row${isDragging ? " dragging" : ""}`}
    >
      <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`Move preference ${rank}, ${item.branch} at ${item.collegeName}`}>
        <Icon name="menu" size={16} />
      </button>
      <span className="list-rank">{rank}</span>
      <div className="list-detail">
        <Link to={`/colleges/${item.collegeCode}`} className="list-college">{item.collegeName}</Link>
        <span className="list-branch">{item.branch}</span>
        <span className="list-meta">
          <span className="list-code">{item.choiceCode}</span>
          <abbr className="list-seat" title={seatTypeLabel(item.seatType)}>{seatTypeShortLabel(item.seatType)}</abbr>
        </span>
      </div>
      <div className="list-merit-col">
        <span className="list-closing">{formatNumber(item.closingMerit)}</span>
        {merit > 0 && (
          <span className={`list-surplus${surplus >= 0 ? " pos" : " neg"}`}>
            {surplus >= 0 ? `${formatNumber(surplus)} to spare` : `${formatNumber(-surplus)} short`}
          </span>
        )}
      </div>
      <button type="button" className="list-remove" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.branch} at ${item.collegeName}`}>
        <Icon name="close" size={16} />
      </button>
    </li>
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
    try {
      await navigator.clipboard.writeText(codes);
    } catch {
      return;
    }
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

  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? "Open";

  return (
    <div className="page list-page">
      <PageHeader
        breadcrumb={[{ label: "My CAP plan" }]}
        title="Option form"
        subtitle={
          items.length === 0
            ? "Build the list of choice codes you will fill in the CAP option form, in order of preference."
            : `${items.length} of ${OPTION_FORM_MAX} choices. Drag to reorder: CAP allots the first choice on your list that your rank qualifies for.`
        }
        actions={
          items.length > 0 && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportCSV(items, merit)}>
                Download CSV
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handlePDF} disabled={pdfLoading}>
                {pdfLoading ? "Preparing…" : "Download PDF"}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleCopyCodes}>
                <Icon name={copied ? "check" : "clipboard"} size={16} />
                {copied ? "Codes copied" : "Copy choice codes"}
              </button>
            </>
          )
        }
      />
      <PlanSubnav />

      {items.length === 0 ? (
        <div className="empty-state">
          <Icon name="list" size={28} className="empty-state-icon" />
          <h2>Your option form is empty</h2>
          <p>
            Find your options, then use the <strong>+</strong> button next to any branch to add it here. You can reorder,
            export to PDF or CSV, and copy the choice codes into the CAP portal.
          </p>
          <Link to="/" className="btn btn-primary">
            <Icon name="search" size={18} />
            Find my options
          </Link>
        </div>
      ) : (
        <>
          {merit > 0 && (
            <p className="list-merit-bar">
              Your merit <strong>{formatNumber(merit)}</strong>
              <span className="badge badge-sample">{categoryLabel}</span>
              <Link to="/profile">Change</Link>
            </p>
          )}

          <div className="list-table card">
            <div className="list-table-head" aria-hidden="true">
              <span />
              <span>#</span>
              <span>College, branch and choice code</span>
              <span className="lth-merit">Closing rank</span>
              <span />
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ol className="list-rows">
                  {items.map((item, i) => (
                    <SortableRow key={item.id} item={item} rank={i + 1} merit={merit} onRemove={handleRemove} />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          </div>

          <div className="list-next">
            <Link to="/simulator" className="list-next-card card">
              <Icon name="play" size={20} />
              <span>
                <strong>Test this list in the simulator</strong>
                <span>See which choice you would likely get in each round.</span>
              </span>
              <Icon name="arrowRight" size={18} />
            </Link>
            <Link to="/guide?tab=freeze" className="list-next-card card">
              <Icon name="steps" size={20} />
              <span>
                <strong>After allotment: freeze, float or slide?</strong>
                <span>What each choice means and when to use it.</span>
              </span>
              <Icon name="arrowRight" size={18} />
            </Link>
          </div>

          <p className="list-footnote">
            Closing ranks from official CET Cell CAP lists. Your list is saved in this browser only.
          </p>
        </>
      )}
    </div>
  );
}
