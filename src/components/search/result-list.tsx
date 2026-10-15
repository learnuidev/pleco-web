"use client";

import { motion } from "framer-motion";
import { Loader2, SearchX } from "lucide-react";
import { useEffect, useRef } from "react";

import { Glyph } from "@/components/glyph";
import { useWorkbench } from "@/components/workbench/state";
import type { ApiSearchResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<string, string> = {
  word: "exact",
  character: "character",
  pinyin: "pinyin",
  english: "english",
  contains: "contains",
};

function glossPreview(definition: string, max = 3): string {
  return definition.split("/").filter(Boolean).slice(0, max).join("; ");
}

export function ResultList({
  result,
  loading,
  error,
  onSelect,
}: {
  result: ApiSearchResponse | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: number) => void;
}) {
  const { state, headword, traditionalHint } = useWorkbench();
  const listRef = useRef<HTMLUListElement | null>(null);
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [state.activeHitId]);

  if (error) {
    return (
      <Empty title="Search unavailable" body={error} tone="error" />
    );
  }

  if (!result && !loading) {
    return (
      <Empty
        title="Look up anything"
        body="Type Chinese characters, pinyin with or without tones (xue, xué, xue3), or an English word."
      />
    );
  }

  if (result && result.hits.length === 0 && !loading) {
    return (
      <Empty
        title={`No results for “${result.query}”`}
        body="Try a single character, a shorter pinyin syllable, or a simpler English word."
        icon={SearchX}
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {loading ? (
        <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2">
          <span className="material hairline-ring inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground shadow-raised">
            <Loader2 className="size-3 animate-spin" />
            searching…
          </span>
        </div>
      ) : null}

      <div className="hairline-b flex items-baseline justify-between gap-2 px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {result ? `${result.total} result${result.total === 1 ? "" : "s"}` : "Results"}
        </span>
        {result && result.segments.length > 1 ? (
          <span className="glyph truncate text-[11px] text-muted-foreground">
            segmented: {result.segments.join(" · ")}
          </span>
        ) : result ? (
          <span className="text-[11px] text-muted-foreground tabular">{result.elapsedMs} ms</span>
        ) : null}
      </div>

      <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {result?.hits.map((hit, index) => {
          const active = state.activeHitId === hit.entry.id;
          const label = headword(hit.entry);
          const alt = traditionalHint(hit.entry);

          return (
            <motion.li
              key={`${hit.entry.id}-${index}`}
              ref={active ? activeRef : null}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(index, 12) * 0.012 }}
            >
              <button
                type="button"
                onClick={() => onSelect(hit.entry.id)}
                className={cn(
                  "focus-halo group flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-foreground/6",
                )}
              >
                <Glyph
                  size={Array.from(label).length > 2 ? "sm" : "md"}
                  className={cn(
                    "mt-0.5 min-w-[2ch] shrink-0",
                    active ? "text-primary-foreground" : "text-foreground",
                  )}
                >
                  {label}
                </Glyph>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-[13px] font-medium",
                        active ? "text-primary-foreground" : "text-primary",
                      )}
                    >
                      {hit.pinyin}
                    </span>
                    {alt ? (
                      <span
                        className={cn(
                          "glyph shrink-0 text-[12px]",
                          active ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {alt}
                      </span>
                    ) : null}
                    {hit.frequency ? (
                      <span
                        className={cn(
                          "tabular ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px]",
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : hit.frequency <= 1000
                              ? "bg-primary/10 text-primary"
                              : "bg-foreground/6 text-muted-foreground",
                        )}
                        title={`Frequency rank #${hit.frequency}`}
                      >
                        #{hit.frequency}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "ml-auto shrink-0 text-[10px] uppercase tracking-wide",
                          active ? "text-primary-foreground/60" : "text-muted-foreground/70",
                        )}
                      >
                        {MODE_LABEL[hit.matchedOn]}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[12px] leading-snug",
                      active ? "text-primary-foreground/85" : "text-muted-foreground",
                    )}
                  >
                    {glossPreview(hit.entry.definition)}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
        {result?.truncated ? (
          <li className="px-3 py-3 text-center text-[11px] text-muted-foreground">
            Showing the first {result.hits.length} matches — refine your query for more.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Empty({
  title,
  body,
  icon: Icon,
  tone,
}: {
  title: string;
  body: string;
  icon?: typeof SearchX;
  tone?: "error";
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      {Icon ? (
        <Icon
          className={cn("size-5", tone === "error" ? "text-destructive" : "text-muted-foreground")}
        />
      ) : null}
      <p className={cn("text-[13px] font-medium", tone === "error" && "text-destructive")}>
        {title}
      </p>
      <p className="max-w-xs text-[12px] leading-relaxed text-muted-foreground text-pretty">
        {body}
      </p>
    </div>
  );
}
