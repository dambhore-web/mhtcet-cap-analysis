import { useCallback, useEffect, useState } from "react";
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
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AUTO_FREEZE_TOP_N, BAND_LABELS } from "@mhtcet/core";
import { api } from "../lib/api";
import { saveList, removeFromList, useList, OPTION_FORM_MAX, type ListItem } from "../lib/list";
import { useProfile } from "../lib/ProfileContext";
import { PageHeader } from "../components/PageHeader";
import { PlanNextStep, PlanSubnav } from "../components/PlanSubnav";
import { Icon } from "../components/Icon";
import { formatNumber, formatRound } from "../lib/format";
import { seatTypeLabel, seatTypeShortLabel } from "../lib/seatType";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { coverageChecks, freezeRoundOf, listChecks, listCoverage, reachOf, type ListCoverage, type Reach } from "../lib/optionForm";
import "./ListPage.css";

const REACH_TEXT: Record<Reach, string> = {
  "round-I": "Got in Round I",
  later: "Got in a later round",
  out: "Out of reach",
  unknown: "",
};

/** Rounds with an auto-freeze zone (core AUTO_FREEZE_TOP_N: Round I choice 1, II 1–3, III 1–6). */
const FREEZE_ROUNDS = (["I", "II", "III"] as const).filter((r) => AUTO_FREEZE_TOP_N[r] != null);

/**
 * Three bars in the row's left edge, one per round: a bar is drawn where this position would lock a
 * seat in that round, so the freeze zones read as brackets down the list (TASK-0004).
 */
function FreezeGutter({ rank, count }: { rank: number; count: number }) {
  return (
    <span className="list-gutter" aria-hidden="true">
      {FREEZE_ROUNDS.map((r, k) => {
        const n = Math.min(AUTO_FREEZE_TOP_N[r] ?? 0, count);
        const on = rank <= n;
        return <i key={r} className={`fz fz-${k}${on ? " on" : ""}${on && rank === 1 ? " top" : ""}${on && rank === n ? " bot" : ""}`} />;
      })}
    </span>
  );
}

function SortableRow({
  item,
  index,
  count,
  merit,
  onRemove,
  onMove,
}: {
  item: ListItem;
  index: number;
  count: number;
  merit: number | null;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const rank = index + 1;
  const reach = reachOf(item, merit);
  const freeze = freezeRoundOf(rank);
  const what = `${item.branch} at ${item.collegeName}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`list-row${isDragging ? " dragging" : ""}${freeze ? " in-freeze" : ""}`}
    >
      <FreezeGutter rank={rank} count={count} />
      <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`Drag to reorder choice ${rank}, ${what}`}>
        <Icon name="menu" size={16} />
      </button>
      <span className="list-rank">
        {rank}
        {freeze && (
          <span className="list-freeze" title={`Auto-freezes if allotted in ${formatRound(freeze)} or later`}>
            <Icon name="lock" size={12} />
            <span className="sr-only">Auto-freeze zone from {formatRound(freeze)}</span>
          </span>
        )}
      </span>
      <div className="list-detail">
        <Link to={`/colleges/${item.collegeCode}`} className="list-college">{item.collegeName}</Link>
        <span className="list-branch">{item.branch}</span>
        <span className="list-meta">
          <span className="list-code">{item.choiceCode}</span>
          <abbr className="list-seat" title={seatTypeLabel(item.seatType)}>{seatTypeShortLabel(item.seatType)}</abbr>
        </span>
      </div>
      <div className="list-merit-col">
        <span className="list-closing">
          {item.firstRoundClosing != null && item.lastRoundClosing != null
            ? `${formatNumber(item.firstRoundClosing)} → ${formatNumber(item.lastRoundClosing)}`
            : formatNumber(item.closingMerit)}
        </span>
        {reach !== "unknown" && <span className={`list-reach list-reach--${reach}`}>{REACH_TEXT[reach]}</span>}
      </div>
      <div className="list-actions">
        <button type="button" className="list-icon-btn" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label={`Move ${what} up`}>
          <Icon name="arrowUp" size={16} />
        </button>
        <button type="button" className="list-icon-btn list-down" onClick={() => onMove(index, index + 1)} disabled={index === count - 1} aria-label={`Move ${what} down`}>
          <Icon name="arrowUp" size={16} />
        </button>
        <button type="button" className="list-icon-btn list-remove" onClick={() => onRemove(item.id)} aria-label={`Remove ${what}`}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </li>
  );
}

/** My CAP plan step 1, journey J8: order the choices that go into the CAP option form. */
export function ListPage() {
  const { profile } = useProfile();
  const items = useList();
  const merit = profile.meritNumber;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === (profile.category ?? ""))?.label ?? "Open";
  const [districts, setDistricts] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    let live = true;
    api.colleges("")
      .then((r) => live && setDistricts(new Map(r.colleges.filter((c) => c.district).map((c) => [c.code, c.district!]))))
      .catch(() => {}); // coverage works without districts
    return () => { live = false; };
  }, []);
  const coverage = items.length > 0 ? listCoverage(items, merit, districts ? (code) => districts.get(code) ?? null : undefined) : null;
  const checks = [...listChecks(items, merit), ...(coverage ? coverageChecks(coverage) : [])];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= items.length) return;
      saveList(arrayMove(items, from, to));
    },
    [items],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    move(items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
  }

  return (
    <div className="page list-page">
      <PageHeader
        breadcrumb={[{ label: "My CAP plan" }, { label: "Option form" }]}
        title="Your CAP option form"
        subtitle={
          items.length === 0
            ? "Build the list of choice codes you will fill in the CAP option form, in order of preference."
            : `${items.length} of ${OPTION_FORM_MAX} choices. Order matters: in each round CAP gives you the highest choice on this list that has a seat for your merit.`
        }
        actions={
          <Link to="/list/add" className="btn btn-primary btn-sm">
            <Icon name="plus" size={16} />
            Add options from any college
          </Link>
        }
      />
      <PlanSubnav />

      {items.length === 0 ? (
        <div className="empty-state">
          <Icon name="list" size={28} className="empty-state-icon" />
          <h2>Your option form is empty</h2>
          <p>
            Find your options, or browse any college, and use the <strong>+</strong> button to add a branch here. Then order
            the list, test it in the simulator and export it for the CAP portal.
          </p>
          <div className="list-empty-actions">
            <Link to="/find" className="btn btn-primary">
              <Icon name="search" size={18} />
              Find my options
            </Link>
            <Link to="/list/add" className="btn btn-secondary">Add options from any college</Link>
          </div>
        </div>
      ) : (
        <div className="list-layout">
          <div className="list-main">
            {merit ? (
              <p className="list-merit-bar">
                Your merit <strong>{formatNumber(merit)}</strong>
                <span className="badge badge-sample">{categoryLabel}</span>
                <Link to="/profile">Change</Link>
              </p>
            ) : null}

            <p className="list-freeze-key">
              {FREEZE_ROUNDS.map((r, k) => (
                <span key={r}><i className={`fz fz-${k}`} />Auto-freeze from {formatRound(r)} (choice{AUTO_FREEZE_TOP_N[r] === 1 ? "" : "s"} 1{AUTO_FREEZE_TOP_N[r] === 1 ? "" : `–${AUTO_FREEZE_TOP_N[r]}`})</span>
              ))}
            </p>
            <div className="list-table card">
              <div className="list-table-head" aria-hidden="true">
                <span>Freeze</span>
                <span />
                <span>#</span>
                <span>College, branch and choice code</span>
                <span className="lth-merit">Closing rank, R I → last</span>
                <span />
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <ol className="list-rows" aria-label="Choices in order of preference">
                    {items.map((item, i) => (
                      <SortableRow key={item.id} item={item} index={i} count={items.length} merit={merit} onRemove={removeFromList} onMove={move} />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            </div>
            <p className="list-footnote">
              Closing ranks from official CET Cell CAP lists. Your option form is saved in this browser only.
            </p>
            <PlanNextStep current="/list" />
          </div>

          <aside className="list-side" aria-label="About your option form">
            <section className="card list-side-card">
              <h2 className="label">The auto-freeze rule</h2>
              <p>If you are allotted one of your top choices, the seat locks and you can't move up in later rounds.</p>
              <ul className="list-freeze-rules">
                {(["I", "II", "III"] as const).map((r) => {
                  const n = AUTO_FREEZE_TOP_N[r] ?? 0;
                  return (
                    <li key={r}>
                      <Icon name="lock" size={14} />
                      {formatRound(r)}: {n === 1 ? "choice 1" : `choices 1–${n}`}
                    </li>
                  );
                })}
              </ul>
              <p className="list-side-note">Rules as published for 2025-26. <Link to="/guide?tab=freeze">Read more</Link></p>
            </section>
            {coverage && (
              <section className="card list-side-card" aria-labelledby="list-checks-title">
                <h2 id="list-checks-title" className="label">Checks on your list</h2>
                <CoveragePanel c={coverage} />
                {checks.length > 0 && <ul className="list-checks">
                  {checks.map((c) => (
                    <li key={c.text} className={`list-check list-check--${c.level}`}>
                      <Icon name={c.level === "warn" ? "alert" : "help"} size={16} />
                      {c.text}
                    </li>
                  ))}
                </ul>}
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

const BAND_ORDER = ["likely", "target", "reach", "out"] as const;
const pct = (share: number) => `${Math.round(share * 100)}%`;

/** How the list is spread (#137): bands as one bar, then branch groups, districts and size. */
function CoveragePanel({ c }: { c: ListCoverage }) {
  return (
    <div className="list-coverage" aria-label="Coverage">
      {c.bands && (
        <div className="lc-bands">
          <div className="lc-bar" aria-hidden="true">
            {BAND_ORDER.map((b) => c.bands![b] > 0 && <span key={b} className={`lc-seg lc-seg--${b}`} style={{ flexGrow: c.bands![b] }} />)}
          </div>
          <ul className="lc-legend">
            {BAND_ORDER.map((b) => (
              <li key={b} className={`lc-key lc-key--${b}`}>
                <span className="lc-dot" aria-hidden="true" />
                <strong className="mono">{c.bands![b]}</strong> {BAND_LABELS[b]}
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl className="lc-facts">
        <div>
          <dt>Branch groups</dt>
          <dd><strong className="mono">{c.groups.distinct}</strong>{c.groups.distinct > 1 && <> · most are {c.groups.top.name} ({pct(c.groups.top.share)})</>}{c.groups.distinct === 1 && <> · all {c.groups.top.name}</>}</dd>
        </div>
        {c.districts && (
          <div>
            <dt>Districts</dt>
            <dd><strong className="mono">{c.districts.distinct}</strong>{c.districts.distinct > 1 ? <> · most in {c.districts.top.name} ({pct(c.districts.top.share)})</> : <> · all in {c.districts.top.name}</>}</dd>
          </div>
        )}
        <div>
          <dt>Choices</dt>
          <dd><strong className="mono">{c.size}</strong> of {c.max} allowed</dd>
        </div>
      </dl>
    </div>
  );
}
