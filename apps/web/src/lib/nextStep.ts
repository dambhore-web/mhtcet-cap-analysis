import type { Allotment } from "./allotment";
import { formatRound } from "./format";
import { decidedOn, type Progress } from "./progress";

/**
 * "What should I do next?" (#135): one primary action from what this browser already knows.
 * The wording names the step, never an outcome ("Test your list", not "Get your seat").
 */
export type StepId = "estimate" | "add-choices" | "simulate" | "export" | "allotment" | "summary";

export interface NextStep {
  id: StepId;
  /** short eyebrow: where the student is */
  stage: string;
  title: string;
  text: string;
  cta: string;
  to: string;
  secondary?: { label: string; to: string };
}

export interface StepState {
  merit: number | null;
  listSize: number;
  allotment: Allotment | null;
  progress: Progress;
}

export function nextStep({ merit, listSize, allotment, progress }: StepState): NextStep {
  if (allotment) {
    if (decidedOn(progress, allotment))
      return {
        id: "summary",
        stage: "After allotment",
        title: "Share the family summary",
        text: "One page with your merit number, your option form and the seat you were allotted, to show your family.",
        cta: "Open the family summary",
        to: "/summary",
        secondary: { label: "Review freeze, float or slide", to: "/allotment" },
      };
    return {
      id: "allotment",
      stage: `Allotted in ${formatRound(allotment.round)}`,
      title: "Freeze, float or slide?",
      text: "See which of your higher choices opened up last year, and what each option means for this seat.",
      cta: "Decide on your seat",
      to: "/allotment",
    };
  }
  if (!merit)
    return {
      id: "estimate",
      stage: "Before the merit list",
      title: "Estimate where you stand",
      text: "No merit number yet? Your MHT-CET percentile gives a likely range, and the colleges that range reached last year.",
      cta: "Estimate from your percentile",
      to: "/estimate",
      secondary: { label: "I have my merit number", to: "/find" },
    };
  if (listSize === 0)
    return {
      id: "add-choices",
      stage: "Choosing colleges",
      title: "Add choices to your option form",
      text: "Tap + next to an option in your results to add it. Your option form keeps them in the order you will fill on the CET Cell portal.",
      cta: "Go to your results",
      to: "/find#results-title",
      secondary: { label: "Search any college", to: "/list/add" },
    };
  if (!progress.simulatedAt)
    return {
      id: "simulate",
      stage: `${listSize} ${listSize === 1 ? "choice" : "choices"} on your option form`,
      title: "Test your list in the simulator",
      text: "Replay last year's rounds with your list to see where it would have placed you, and whether the order matters.",
      cta: "Test your list",
      to: "/simulator",
      secondary: { label: "Review the order", to: "/list" },
    };
  if (!progress.exportedAt)
    return {
      id: "export",
      stage: "List tested",
      title: "Export for the CAP portal",
      text: "Your choice codes in order, as a PDF, Excel sheet or plain list, ready to type into the CET Cell option form.",
      cta: "Export your choice codes",
      to: "/export",
      secondary: { label: "Test again", to: "/simulator" },
    };
  return {
    id: "allotment",
    stage: "Option form exported",
    title: "When your allotment comes out",
    text: "Enter the seat you were allotted to see whether to freeze, float or slide.",
    cta: "Enter your allotment",
    to: "/allotment",
    secondary: { label: "Edit your option form", to: "/list" },
  };
}
