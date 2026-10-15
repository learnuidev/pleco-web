"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiSearchResponse } from "@/lib/api-types";

/**
 * Debounced dictionary search against /api/search, with in-flight request
 * cancellation and a cache so repeated keystrokes and back-navigation are
 * instant.
 */

const cache = new Map<string, ApiSearchResponse>();
const inflight = new Map<string, AbortController>();

export type SearchState = {
  data: ApiSearchResponse | null;
  loading: boolean;
  error: string | null;
};

export function useDictionarySearch(query: string, limit = 60, delay = 110): SearchState {
  const [state, setState] = useState<SearchState>(() => {
    const cached = cache.get(query);
    return { data: cached ?? null, loading: false, error: null };
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Guards against an older request resolving after a newer query started. */
  const latest = useRef(query);

  const run = useCallback(
    async (value: string) => {
      const trimmed = value.trim();

      if (!trimmed) {
        setState({ data: null, loading: false, error: null });
        return;
      }

      const cached = cache.get(trimmed);
      if (cached) {
        setState({ data: cached, loading: false, error: null });
        return;
      }

      inflight.get(trimmed)?.abort();
      const controller = new AbortController();
      inflight.set(trimmed, controller);

      setState((previous) => ({ data: previous.data, loading: true, error: null }));

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as ApiSearchResponse;
        cache.set(trimmed, data);
        if (latest.current.trim() !== trimmed) return;
        setState({ data, loading: false, error: null });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (latest.current.trim() !== trimmed) return;
        setState({ data: null, loading: false, error: (error as Error).message });
      } finally {
        inflight.delete(trimmed);
      }
    },
    [limit],
  );

  useEffect(() => {
    latest.current = query;
    if (timer.current) clearTimeout(timer.current);
    const immediate = query.trim().length <= 1;
    timer.current = setTimeout(() => void run(query), immediate ? 0 : delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, run, delay]);

  return state;
}
