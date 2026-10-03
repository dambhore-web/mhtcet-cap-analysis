import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BRANCH_GROUPS, type Candidature, type Category } from "../lib/api";
import { CATEGORY_OPTIONS, FLAG_OPTIONS, MINORITY_OPTIONS } from "../lib/categories";
import { UNIVERSITIES } from "../lib/universities";
import { answersSummary, branchesLabel, specialSeatsLabel, type SeatFlag, type TileAnswers } from "../lib/answerTiles";
import { parseMerit } from "../lib/onboarding";
import { parsePercentileText, type ScoreKind } from "../lib/percentile";
import { Icon } from "./Icon";
import "./AnswerTiles.css";

interface Props {
  answers: TileAnswers;
  /** The merit number or percentile as typed. */
  merit: string;
  meritError: string;
  /** Whether the score tile takes a merit number or a percentile (before the merit list is out). */
  scoreKind: ScoreKind;
  onScoreKind: (kind: ScoreKind) => void;
  branchGroups: string[];
  onChange: (patch: Partial<TileAnswers>) => void;
  onMeritInput: (text: string) => void;
  /** Enter or leaving the field: search now instead of after the typing pause. */
  onMeritCommit: () => void;
  onBranchGroups: (groups: string[]) => void;
}

/**
 * The answers from the step-by-step questions, as tiles above the results (#142).
 * Each tile changes one answer with a dropdown; Find colleges searches again straight away.
 * On a phone the tiles fold into one "Your answers" line.
 */
export function AnswerTiles({ answers, merit, meritError, scoreKind, onScoreKind, branchGroups, onChange, onMeritInput, onMeritCommit, onBranchGroups }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const state = answers.exam === "MH";
  const pct = scoreKind === "percentile";
  const scoreLabel = pct ? (state ? "MHT-CET percentile" : "JEE Main percentile") : state ? "Merit number" : "All India merit number";

  return (
    <section className={`answer-tiles${open ? " open" : ""}`} aria-label="Your answers">
      <button type="button" className="at-summary" aria-expanded={open} aria-controls={`${id}-grid`} onClick={() => setOpen((v) => !v)}>
        <span className="at-summary-text">
          <strong>Your answers</strong>
          <span>{answersSummary(answers, pct ? null : parseMerit(merit), branchGroups, pct ? parsePercentileText(merit) : null)}</span>
        </span>
        <span className="at-summary-action">{open ? "Done" : "Change"}</span>
        <Icon name={open ? "minus" : "plus"} size={16} />
      </button>

      <div className={`at-grid${state ? "" : " at-grid--ai"}`} id={`${id}-grid`}>
        <Tile label="Exam" htmlFor={`${id}-exam`}>
          <select id={`${id}-exam`} value={answers.exam} onChange={(e) => onChange({ exam: e.target.value as Candidature })}>
            <option value="MH">MHT-CET</option>
            <option value="AI">JEE Main</option>
          </select>
        </Tile>

        <Tile label={scoreLabel} htmlFor={`${id}-merit`} invalid={!!meritError}>
          <input
            id={`${id}-merit`}
            type="text"
            inputMode={pct ? "decimal" : "numeric"}
            autoComplete="off"
            placeholder={pct ? "e.g. 96.42" : "e.g. 12450"}
            value={merit}
            onChange={(e) => onMeritInput(e.target.value)}
            onBlur={onMeritCommit}
            onKeyDown={(e) => { if (e.key === "Enter") onMeritCommit(); }}
            aria-invalid={!!meritError}
            aria-describedby={meritError ? `${id}-merit-error` : undefined}
          />
          {meritError && <span id={`${id}-merit-error`} className="at-error" role="alert">{meritError}</span>}
          <button type="button" className="at-switch" onClick={() => onScoreKind(pct ? "merit" : "percentile")}>
            {pct ? "Use merit number instead" : "Use percentile instead"}
          </button>
        </Tile>

        {state && (
          <Tile label="Category" htmlFor={`${id}-cat`}>
            <select id={`${id}-cat`} value={answers.category} onChange={(e) => onChange({ category: e.target.value as Category | "" })}>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Tile>
        )}

        <Tile label="Gender" htmlFor={`${id}-gen`}>
          <select id={`${id}-gen`} value={answers.gender} onChange={(e) => onChange({ gender: e.target.value as "M" | "F" })}>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </Tile>

        {state && (
          <Tile label="Home university" htmlFor={`${id}-hu`} wide>
            <select id={`${id}-hu`} value={answers.homeUniversity} onChange={(e) => onChange({ homeUniversity: e.target.value })}>
              <option value="">Not sure / state level</option>
              {UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Tile>
        )}

        {state && (
          <MenuTile label="Special seats" value={specialSeatsLabel(answers)}>
            {FLAG_OPTIONS.map((f) => {
              const blocked = f.key === "ews" && !!answers.category;
              return (
                <label key={f.key} className={blocked ? "disabled" : ""}>
                  <input
                    type="checkbox"
                    checked={answers[f.key] && !blocked}
                    disabled={blocked}
                    onChange={() => onChange({ [f.key]: !answers[f.key] } as Partial<Record<SeatFlag, boolean>>)}
                  />
                  <span className="at-menu-text">
                    {f.label}
                    <small>{blocked ? "Only for Open category" : f.desc}</small>
                  </span>
                </label>
              );
            })}
          </MenuTile>
        )}

        {state && (
          <Tile label="Minority" htmlFor={`${id}-min`}>
            <select id={`${id}-min`} value={answers.minority} onChange={(e) => onChange({ minority: e.target.value })}>
              <option value="">None</option>
              {MINORITY_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Tile>
        )}

        <MenuTile label="Branches" value={branchesLabel(branchGroups)} wide alignEnd>
          {BRANCH_GROUPS.map((g) => (
            <label key={g}>
              <input
                type="checkbox"
                checked={branchGroups.includes(g)}
                onChange={() => onBranchGroups(branchGroups.includes(g) ? branchGroups.filter((x) => x !== g) : [...branchGroups, g])}
              />
              <span className="at-menu-text">{g}</span>
            </label>
          ))}
          <button type="button" className="at-menu-reset" disabled={!branchGroups.length} onClick={() => onBranchGroups([])}>
            Show all branches
          </button>
        </MenuTile>
      </div>
    </section>
  );
}

function Tile({ label, htmlFor, wide, invalid, children }: { label: string; htmlFor: string; wide?: boolean; invalid?: boolean; children: ReactNode }) {
  return (
    <div className={`at-tile${wide ? " wide" : ""}${invalid ? " invalid" : ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

/** A tile whose dropdown holds checkboxes (several answers at once). Closes on Escape or a click outside. */
function MenuTile({ label, value, wide, alignEnd, children }: { label: string; value: string; wide?: boolean; alignEnd?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`at-tile${wide ? " wide" : ""}${open ? " open" : ""}`}>
      <span className="at-key" id={`${id}-label`}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className="at-dd"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen((v) => !v)}
      >
        <span id={`${id}-value`}>{value}</span>
      </button>
      {open && (
        <div className={`at-menu${alignEnd ? " end" : ""}`} id={`${id}-menu`} role="group" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}
