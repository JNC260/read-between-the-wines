import { useEffect, useState } from "react";

// Whether a CSS media query matches, kept up to date as the window resizes
// or a phone turns. False where matchMedia doesn't exist (tests), which is
// the wide layout.
export const useMediaQuery = (query: string) => {
  const get = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
};
