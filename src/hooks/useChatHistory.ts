"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { chatSession } from "@/lib/chat-store";
import type { ChatSummary } from "@/lib/chat-types";
import { groupByDate, type DateGroup } from "@/lib/group-by-date";

/**
 * Reads the conversation list from the reactive session store and layers on
 * search + date grouping for the sidebar.
 *
 * The list itself comes from `useSyncExternalStore`, so it updates when any
 * tab changes history and never re-renders on streamed tokens (those only
 * touch the active chat's messages, a separate snapshot).
 */
export function useChatHistory() {
  const summaries = useSyncExternalStore(
    chatSession.subscribe,
    chatSession.getSummariesSnapshot,
    chatSession.getServerSummaries,
  );
  const storageAvailable = useSyncExternalStore(
    chatSession.subscribe,
    chatSession.getStorageAvailableSnapshot,
    chatSession.getServerTrue,
  );

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Load the list once on mount.
  useEffect(() => {
    void chatSession.refreshList();
  }, []);

  // Debounce the search input (~200ms).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo<ChatSummary[]>(() => {
    if (!debouncedQuery) return [...summaries];
    return summaries.filter(
      (s) => s.title.toLowerCase().includes(debouncedQuery) || s.preview.toLowerCase().includes(debouncedQuery),
    );
  }, [summaries, debouncedQuery]);

  const groups = useMemo<DateGroup[]>(() => groupByDate(filtered), [filtered]);

  return {
    summaries,
    groups,
    query,
    setQuery,
    isSearching: debouncedQuery.length > 0,
    hasAny: summaries.length > 0,
    hasResults: filtered.length > 0,
    storageAvailable,
    rename: chatSession.rename,
    remove: chatSession.remove,
    clearAll: chatSession.clearAll,
  };
}

/**
 * A polite aria-live announcer. Returns a node to render once and a function
 * to announce transient messages (e.g. "Chat deleted").
 */
export function useAnnouncer() {
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const announce = useCallback((text: string) => {
    setMessage("");
    // Re-set on the next frame so identical consecutive messages re-announce.
    requestAnimationFrame(() => setMessage(text));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(""), 3000);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { message, announce };
}
