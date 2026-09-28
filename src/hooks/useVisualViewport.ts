"use client";

import { useEffect } from "react";

/**
 * Keeps the sticky input dock above the on-screen keyboard on mobile.
 *
 * When the software keyboard opens, the layout viewport stays the same size but
 * `visualViewport` shrinks. We expose the gap between them as the CSS variable
 * `--keyboard-inset` on the given element, so the input dock can lift by that
 * amount. Desktop and no-keyboard cases resolve to 0.
 */
export function useVisualViewportInset(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const el = ref.current;
    if (!vv || !el) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty("--keyboard-inset", `${inset}px`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [ref]);
}
