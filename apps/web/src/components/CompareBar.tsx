import { Link } from "react-router-dom";
import { useCompare } from "../lib/CompareContext";
import "./CompareBar.css";

export function CompareBar() {
  const { pinned, unpin } = useCompare();
  if (pinned.length === 0) return null;

  return (
    <div className="compare-bar" role="region" aria-label="Comparison tray">
      <div className="compare-bar-colleges">
        {pinned.map((c) => (
          <div key={c.code} className="compare-tile">
            <span className="compare-tile-name">{c.name.split(" ").slice(0, 2).join(" ")}</span>
            <button
              className="compare-tile-remove"
              onClick={() => unpin(c.code)}
              aria-label={`Remove ${c.name} from comparison`}
            >
              ×
            </button>
          </div>
        ))}
        {pinned.length < 3 && (
          <div className="compare-tile empty">
            + add {3 - pinned.length} more
          </div>
        )}
      </div>
      <Link to="/compare" className="compare-bar-btn">
        Compare {pinned.length} →
      </Link>
    </div>
  );
}
