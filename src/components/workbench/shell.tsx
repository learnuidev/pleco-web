"use client";

import { motion } from "framer-motion";
import { Activity, BookOpen, ChevronLeft, ChevronRight, Database } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SearchField } from "@/components/search/search-field";
import { Sidebar } from "@/components/workbench/sidebar";
import { useWorkbench, type HistoryItem } from "@/components/workbench/state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ApiStatusResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";

/**
 * The application shell.
 *
 * Left: navigation + history. Middle: whatever the current route renders
 * (`/dictionary`, `/browse`, `/text`, `/saved`). The window chrome mirrors a
 * macOS document window — a translucent title bar with the search field, a script
 * segmented control and a status readout for the loaded data.
 */
export function WorkbenchShell({ children }: { children: React.ReactNode }) {
  const { state, dispatch, result, runSearch, selectEntry, openEntry, openText } = useWorkbench();
  const [status, setStatus] = useState<ApiStatusResponse | null>(null);

  // Warm the server-side index on first paint so the first search is instant.
  useEffect(() => {
    fetch("/api/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ApiStatusResponse | null) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  /** Reopen a history row: an entry, or a text session in the text reader. */
  const openHistory = (item: HistoryItem) => {
    if (item.kind === "entry") openEntry(item.id, item.headword);
    else openText(item.text);
  };

  const hits = result?.hits ?? [];
  const currentIndex = useMemo(
    () => hits.findIndex((hit) => hit.entry.id === state.selectedId),
    [hits, state.selectedId],
  );

  /** Enter on a query jumps straight into the best match. */
  const searchAndOpen = useMemo(
    () => (query: string) => {
      runSearch(query);
      if (hits.length > 0) selectEntry(hits[0].entry.id);
    },
    [runSearch, hits, selectEntry],
  );

  /** ←/→ step through results once one is selected; ⌘← / ⌘→ walk history. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (hits.length === 0) return;
        event.preventDefault();
        const nextIndex =
          currentIndex === -1
            ? 0
            : Math.min(Math.max(currentIndex + (event.key === "ArrowDown" ? 1 : -1), 0), hits.length - 1);
        selectEntry(hits[nextIndex].entry.id);
      }

      if (event.key === "[" || event.key === "]") {
        if (state.history.length === 0) return;
        event.preventDefault();
        const index = state.history.findIndex(
          (item) => item.kind === "entry" && item.id === state.selectedId,
        );
        const next =
          event.key === "["
            ? Math.min(index === -1 ? 0 : index + 1, state.history.length - 1)
            : Math.max((index === -1 ? 0 : index) - 1, 0);
        openHistory(state.history[next]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hits, currentIndex, selectEntry, state.history, state.selectedId]);

  const scriptLabel = state.script === "simplified" ? "简" : "繁";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* Title bar */}
      <header className="material-strong hairline-b relative z-40 flex h-12 shrink-0 items-center gap-3 px-3.5">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  const index = state.history.findIndex(
                    (item) => item.kind === "entry" && item.id === state.selectedId,
                  );
                  const next = Math.min(index === -1 ? 0 : index + 1, state.history.length - 1);
                  if (state.history[next]) openHistory(state.history[next]);
                }}
                disabled={state.history.length === 0}
                className="focus-halo grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Back in history ( [ )</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  const index = state.history.findIndex(
                    (item) => item.kind === "entry" && item.id === state.selectedId,
                  );
                  const next = Math.max((index === -1 ? 0 : index) - 1, 0);
                  if (state.history[next]) openHistory(state.history[next]);
                }}
                disabled={state.history.length === 0}
                className="focus-halo grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <ChevronRight className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Forward in history ( ] )</TooltipContent>
          </Tooltip>
        </div>

        <SearchField
          value={state.query}
          onChange={(value) => dispatch({ type: "set-query", query: value })}
          onSubmit={searchAndOpen}
          className="mx-auto w-full max-w-[520px]"
        />

        <div className="flex items-center gap-2">
          <div className="material hairline-ring hidden items-center gap-0.5 rounded-full p-0.5 sm:flex">
            {(["simplified", "traditional"] as const).map((script) => {
              const active = state.script === script;
              return (
                <button
                  key={script}
                  type="button"
                  onClick={() => dispatch({ type: "set-script", script })}
                  className={cn(
                    "glyph focus-halo relative rounded-full px-2.5 py-0.5 text-[13px] transition-colors",
                    active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  title={script === "simplified" ? "Prefer simplified forms" : "Prefer traditional forms"}
                >
                  {active ? (
                    <motion.span
                      layoutId="script-pill"
                      className="absolute inset-0 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 520, damping: 38 }}
                    />
                  ) : null}
                  <span className="relative">{script === "simplified" ? "简" : "繁"}</span>
                </button>
              );
            })}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] text-muted-foreground lg:flex">
                <Database className="size-3" />
                <span className="tabular">
                  {status ? status.cedictEntries.toLocaleString() : "…"} entries
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              CC-CEDICT {status?.cedictVersion ?? "loading"} · {status?.strokeCharactersLocal ?? 0}{" "}
              characters cached for offline stroke order
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] text-muted-foreground xl:flex">
                <Activity className="size-3" />
                <span className="tabular">
                  {scriptLabel} · {result ? `${result.elapsedMs} ms` : "idle"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Search mode: {result?.mode ?? "—"}
              {result?.segments.length ? ` · ${result.segments.join(" ")}` : ""}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      </div>

      {/* Status bar */}
      <footer className="material hairline-t flex h-7 shrink-0 items-center gap-3 px-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="size-3" />
          Pleco Web — HanziJS + CC-CEDICT
        </span>
        {result ? (
          <span className="tabular">
            {result.total} match{result.total === 1 ? "" : "es"} for “{result.query}”
          </span>
        ) : null}
        <span className="ml-auto hidden items-center gap-3 md:flex">
          <span>↑↓ navigate</span>
          <span>[ ] history</span>
          <span>⌘K search</span>
        </span>
      </footer>
    </div>
  );
}
