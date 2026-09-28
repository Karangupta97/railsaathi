"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sticky auto-scroll for the message list.
 *
 * Auto-scrolls to the bottom only while the user is already near it. Once they
 * scroll up, we stop following and expose `showJumpButton` so the UI can offer
 * a "Jump to latest" affordance. Call `notifyContentChange()` whenever new
 * content arrives (new message or streamed token).
 */
const NEAR_BOTTOM_PX = 120;

export function useAutoScroll<T extends HTMLElement>() {
  const scrollRef = useRef<T | null>(null);
  const pinnedRef = useRef(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  const isNearBottom = useCallback((el: T) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    pinnedRef.current = true;
    setShowJumpButton(false);
  }, []);

  const notifyContentChange = useCallback(() => {
    if (pinnedRef.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const near = isNearBottom(el);
      pinnedRef.current = near;
      setShowJumpButton(!near);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  return { scrollRef, showJumpButton, scrollToBottom, notifyContentChange };
}
