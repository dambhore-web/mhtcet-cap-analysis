import { firstFreezeRound, type Round } from "@mhtcet/core";
import type { ListItem } from "./list";

export type Reach = "round-I" | "later" | "out" | "unknown";

/** Would last year's closing ranks have admitted this merit number, and when? */
export function reachOf(item: ListItem, merit: number | null): Reach {
  if (!merit) return "unknown";
  const first = item.firstRoundClosing ?? null;
  const last = item.lastRoundClosing ?? item.closingMerit;
  if (first != null && merit <= first) return "round-I";
  if (merit <= last) return "later";
  return "out";
}

/** Freeze-zone marker for a 1-based preference: the first round in which it would auto-freeze. */
export function freezeRoundOf(preference: number): Round | null {
  return firstFreezeRound(preference);
}

export interface ListCheck {
  level: "warn" | "info";
  text: string;
}

/** Plain-language checks on the order of the option form. */
export function listChecks(items: ListItem[], merit: number | null): ListCheck[] {
  const out: ListCheck[] = [];
  if (items.length === 0) return out;
  if (!merit) {
    out.push({ level: "info", text: "Add your merit number to see which choices were within reach last year." });
    return out;
  }
  const reaches = items.map((it) => reachOf(it, merit));
  const firstSafe = reaches.indexOf("round-I");
  const anyReach = reaches.some((r) => r === "round-I" || r === "later");

  if (!anyReach) {
    out.push({ level: "warn", text: "None of your choices admitted your merit number last year, in any round. Add a few choices within reach as a safety net." });
  } else if (firstSafe === -1) {
    out.push({ level: "warn", text: "No choice was within reach in Round I last year. Consider adding one you would have got in Round I." });
  }

  if (firstSafe !== -1 && firstSafe < items.length - 1) {
    const below = items.length - 1 - firstSafe;
    out.push({
      level: "info",
      text: `Choice ${firstSafe + 1} admitted your merit number in Round I last year, so the ${below} ${below === 1 ? "choice" : "choices"} below it would probably never be used. That's fine if they are backups.`,
    });
  }

  if (reaches[0] === "round-I") {
    out.push({ level: "info", text: "Your first choice was within reach in Round I. If you get it, the seat freezes automatically and you won't move to any other choice." });
  }
  return out;
}
