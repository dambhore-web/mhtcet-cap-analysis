import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./SectionNav.css";

export interface NavSection {
  id: string;
  label: string;
}

/**
 * A sticky row of jump links to sections on the same page (#138). Links, not tabs: every section
 * stays on the page, prints, and has its own URL (`#placement`). Pass only the sections that are
 * actually rendered. The active link follows the scroll position and carries aria-current.
 */
export function SectionNav({ sections, label }: { sections: NavSection[]; label: string }) {
  const { hash } = useLocation();
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const key = sections.map((s) => s.id).join(",");
  // a section the reader jumped to stays marked until they scroll themselves, even if it can't reach the line
  const chosen = useRef<string | null>(null);

  // Deep links: the sections render after data loads, so the browser's own jump has already missed.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id || !sections.some((s) => s.id === id)) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    chosen.current = id;
    setActive(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, key]);

  // Active link = the last section whose top has passed the line just under the sticky bars.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (chosen.current) return setActive(chosen.current);
      const line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--section-offset")) || 120) + 8;
      let current = sections[0]?.id ?? "";
      let best = -Infinity;
      for (const s of sections) {
        const top = document.getElementById(s.id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line && top > best) {
          best = top;
          current = s.id;
        }
      }
      // at the very bottom the last sections can never reach the line: mark the lowest one
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40) {
        let lowest = -Infinity;
        for (const s of sections) {
          const top = document.getElementById(s.id)?.getBoundingClientRect().top ?? -Infinity;
          if (top > lowest && top < window.innerHeight) {
            lowest = top;
            current = s.id;
          }
        }
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const release = () => {
      chosen.current = null;
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", release);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (sections.length < 2) return null;

  return (
    <nav className="section-nav" aria-label={label}>
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                history.replaceState(history.state, "", `#${s.id}`);
                chosen.current = s.id;
                setActive(s.id);
              }}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
