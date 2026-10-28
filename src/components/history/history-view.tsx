"use client";

import { Clock3, FileText, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Glyph } from "@/components/glyph";
import { Button } from "@/components/ui/button";
import { useWorkbench, type HistoryItem } from "@/components/workbench/state";

/** Visits closer together than this belong to the same block. */
const BLOCK_MS = 20 * 60 * 1000;

type HistoryBlock = {
  /** When the block's first entry was opened, epoch ms. */
  start: number;
  /** When its last entry was opened. */
  end: number;
  items: HistoryItem[];
};

/**
 * Everything opened in the reader, grouped into blocks of visits that are under
 * 20 minutes apart and listed newest first — in the same page frame as the other
 * tabs (a toolbar over a scrolling grid).
 *
 * History lives in this browser, so the page fills in once the workbench has
 * hydrated.
 */
export function HistoryView() {
  const { state, dispatch, openEntry, openText } = useWorkbench();

  const blocks = useMemo<HistoryBlock[]>(() => {
    const newestFirst = [...state.history].sort((a, b) => b.at - a.at);
    const out: HistoryBlock[] = [];
    let previous: number | null = null;

    for (const item of newestFirst) {
      const current = out[out.length - 1];
      // Walking newest → oldest: keep adding while the gap to the entry after it
      // is under 20 minutes, so a block spans its first and last visit.
      if (current && previous !== null && previous - item.at <= BLOCK_MS) {
        current.items.push(item);
        current.start = item.at;
      } else {
        out.push({ start: item.at, end: item.at, items: [item] });
      }
      previous = item.at;
    }

    return out;
  }, [state.history]);

  const total = state.history.length;

  if (total === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-10 text-center">
        <Clock3 className="size-5 text-muted-foreground" />
        <h2 className="text-[14px] font-semibold">No history yet</h2>
        <p className="max-w-sm text-[12.5px] leading-relaxed text-muted-foreground text-pretty">
          Every entry you open in the reader lands here, grouped into blocks of visits under 20
          minutes apart — stored in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hairline-b flex flex-wrap items-center gap-2 px-4 py-2">
        <Clock3 className="size-3.5 text-muted-foreground" />
        <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {total} {total === 1 ? "entry" : "entries"}
        </span>
        <span className="tabular rounded-full bg-foreground/6 px-1.5 py-px text-[10px] text-muted-foreground">
          {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-[12px]"
            onClick={() => dispatch({ type: "clear-history" })}
          >
            <Trash2 className="size-3.5" />
            <span className="text-destructive">Clear all</span>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {blocks.map((block) => (
            <section
              key={block.start}
              className="rounded-2xl bg-card p-3 shadow-raised ring-1 ring-black/5 dark:ring-white/8"
            >
              <header className="mb-2 flex items-center gap-2">
                <span className="tabular text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {blockLabel(block)}
                </span>
                <span className="tabular rounded-full bg-foreground/6 px-1.5 py-px text-[10px] text-muted-foreground">
                  {block.items.length}
                </span>
              </header>

              <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {block.items.map((item) =>
                  item.kind === "entry" ? (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => openEntry(item.id, item.headword)}
                        className="focus-halo flex w-full items-center gap-2.5 rounded-xl bg-foreground/4 px-2 py-1.5 text-left transition-colors hover:bg-primary/8"
                      >
                        <Glyph size="md" className="shrink-0">
                          {item.headword}
                        </Glyph>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="truncate text-[12.5px] font-medium text-primary">
                              {item.pinyin}
                            </span>
                            <span className="tabular shrink-0 text-[10px] text-muted-foreground">
                              {timeLabel(item.at)}
                            </span>
                          </span>
                          <span className="block truncate text-[11.5px] text-muted-foreground">
                            {item.gloss}
                          </span>
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => openText(item.text)}
                        title={item.text}
                        className="focus-halo flex w-full items-center gap-2.5 rounded-xl bg-foreground/4 px-2 py-1.5 text-left transition-colors hover:bg-primary/8"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="truncate text-[12.5px] font-medium">Text</span>
                            <span className="tabular shrink-0 text-[10px] text-muted-foreground">
                              {timeLabel(item.at)}
                            </span>
                          </span>
                          <span className="glyph block truncate text-[11.5px] text-muted-foreground">
                            {item.text.slice(0, 40)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** "Today · 14:23 – 14:41", spanning the block's first and last visit. */
function blockLabel(block: HistoryBlock): string {
  const start = new Date(block.start);
  const end = new Date(block.end);
  if (block.start === block.end) return `${dayLabel(start)} · ${timeLabel(block.start)}`;
  if (start.toDateString() === end.toDateString()) {
    return `${dayLabel(start)} · ${timeLabel(block.start)} – ${timeLabel(block.end)}`;
  }
  return `${dayLabel(start)} ${timeLabel(block.start)} – ${dayLabel(end)} ${timeLabel(block.end)}`;
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
