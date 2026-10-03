import { useEffect, useState } from "react";

/**
 * An element's width in pixels, kept up to date; SVG charts are drawn at their real width. Returns a
 * callback ref, so it also works for elements that appear after the first render (e.g. after data
 * loads).
 */
export function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return;
    const update = () => node.clientWidth > 0 && setWidth(node.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, width];
}
