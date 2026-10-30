import { useEffect, useRef, useState } from "react";

// An element's width in px, updated as it resizes (a phone turning, a window
// dragged). 0 until it's measured, and where ResizeObserver doesn't exist.
export const useElementWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
};
