import { Link } from "react-router-dom";
import { useCompare } from "../lib/CompareContext";
import { Icon } from "./Icon";
import "./CompareBar.css";

/** The compare tray only makes sense where colleges are browsed or compared. */
export function showsCompareBar(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/colleges") || pathname.startsWith("/compare");
}

export function CompareBar() {
  const { pinned, unpin } = useCompare();
  if (pinned.length === 0) return null;

  return (
    <div className="compare-bar" role="region" aria-label="Colleges to compare">
      <div className="compare-bar-inner">
        <span className="compare-bar-count" aria-hidden="true">{pinned.length}/3</span>
        <div className="compare-bar-colleges">
          {pinned.map((c) => (
            <div key={c.code} className="compare-tile" title={c.name}>
              <span className="compare-tile-name">{c.name}</span>
              <button
                type="button"
                className="compare-tile-remove"
                onClick={() => unpin(c.code)}
                aria-label={`Remove ${c.name} from comparison`}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
        <Link to="/compare" className="btn btn-primary btn-sm compare-bar-btn">
          Compare {pinned.length}
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </div>
  );
}
