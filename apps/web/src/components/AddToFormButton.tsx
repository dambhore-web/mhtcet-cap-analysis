import { addToList, OPTION_FORM_MAX, useList, type ListItem } from "../lib/list";
import { Icon } from "./Icon";

interface Props {
  item: Omit<ListItem, "id">;
  /** "icon" is a round + button for dense rows; "button" is a labelled button. */
  variant?: "icon" | "button";
}

/** Adds one choice code to the option form. Knows about duplicates and the 300-choice limit. */
export function AddToFormButton({ item, variant = "icon" }: Props) {
  const list = useList();
  const added = list.some((i) => i.choiceCode === item.choiceCode);
  const full = !added && list.length >= OPTION_FORM_MAX;
  const what = `${item.branch} at ${item.collegeName}`;
  const label = added ? `${what} is in your option form` : full ? `Option form is full (${OPTION_FORM_MAX} choices)` : `Add ${what} to your option form`;

  if (variant === "button") {
    return (
      <button type="button" className={`btn btn-sm ${added ? "btn-secondary" : "btn-primary"}`} onClick={() => addToList(item)} disabled={added || full} aria-label={label} title={label}>
        <Icon name={added ? "check" : "plus"} size={16} />
        {added ? "In option form" : full ? "Option form full" : "Add to option form"}
      </button>
    );
  }
  return (
    <button type="button" className={`save-btn${added ? " saved" : ""}`} onClick={() => addToList(item)} disabled={added || full} aria-label={label} title={label}>
      <Icon name={added ? "check" : "plus"} size={16} />
    </button>
  );
}
