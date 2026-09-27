import type { FindOption } from "../lib/api";
import { formatRound } from "../lib/format";
import { Icon } from "./Icon";

/** Whether a student with this merit got the seat last year, and in which round. Icon + text, never colour alone. */
export function StatusBadge({ status, round }: { status: FindOption["status"]; round: FindOption["round"] }) {
  if (status === "round-I")
    return <span className="badge badge-safe"><Icon name="check" size={12} />{formatRound(1)}</span>;
  if (status === "later-round")
    return <span className="badge badge-later"><Icon name="clock" size={12} />{round ? formatRound(round) : "Later round"}</span>;
  return <span className="badge badge-out"><Icon name="minus" size={12} />Out of reach</span>;
}
