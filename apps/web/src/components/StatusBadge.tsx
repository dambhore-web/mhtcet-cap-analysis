import { BAND_LABELS, type Band } from "@mhtcet/core";
import type { FindOption } from "../lib/api";
import { formatRound } from "../lib/format";
import { Icon } from "./Icon";

/**
 * Whether a student with this merit got the seat last year, and in which round. Icon + text, never
 * colour alone. With `band` (#136) it leads with Likely / Target / Reach, so the badge always agrees
 * with the count tiles above the results.
 */
export function StatusBadge({ status, round, band }: { status: FindOption["status"]; round: FindOption["round"]; band?: Band }) {
  if (status === "round-I")
    return <span className="badge badge-safe"><Icon name="check" size={12} />{band ? `${BAND_LABELS.likely} · ` : ""}{formatRound(1)}</span>;
  if (status === "later-round")
    return <span className="badge badge-later"><Icon name="clock" size={12} />{band ? `${BAND_LABELS.target} · ` : ""}{round ? formatRound(round) : "Later round"}</span>;
  if (band === "reach")
    return <span className="badge badge-reach"><Icon name="arrowUp" size={12} />{BAND_LABELS.reach}</span>;
  return <span className="badge badge-out"><Icon name="minus" size={12} />Out of reach</span>;
}
