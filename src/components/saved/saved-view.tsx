"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookMarked, Download, Search, Trash2 } from "lucide-react";

import { Glyph } from "@/components/glyph";
import { ExportSheet } from "@/components/saved/export-sheet";
import { useWorkbench } from "@/components/workbench/state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

/** Saved-words list, with tab-separated export for Anki/Pleco import. */
export function SavedView({
  onSelectEntry,
  onSearch,
}: {
  onSelectEntry: (id: number, headword?: string) => void;
  onSearch: (query: string) => void;
}) {
  const { state, dispatch } = useWorkbench();
  const [exporting, setExporting] = useState(false);

  if (state.saved.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-10 text-center">
        <BookMarked className="size-5 text-muted-foreground" />
        <h2 className="text-[14px] font-semibold">No saved words yet</h2>
        <p className="max-w-sm text-[12.5px] leading-relaxed text-muted-foreground text-pretty">
          Hit <span className="font-medium text-foreground">Save</span> on any entry and it lands
          here — stored in this browser, exportable as a tab-separated list.
        </p>
        <Button variant="outline" size="sm" className="mt-1 rounded-full" onClick={() => onSearch("你好")}>
          <Search className="size-3.5" />
          Look something up
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hairline-b flex items-center gap-2 px-4 py-2">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {state.saved.length} saved
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-[12px]"
            onClick={() => setExporting(true)}
          >
            <Download className="size-3.5" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-[12px] text-destructive hover:bg-destructive/12"
            onClick={() => state.saved.forEach((item) => dispatch({ type: "remove-saved", id: item.id }))}
          >
            <Trash2 className="size-3.5" />
            Clear all
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {state.saved.map((item, index) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: Math.min(index, 20) * 0.012, duration: 0.18 }}
                className="group relative rounded-2xl bg-card p-3 shadow-raised ring-1 ring-black/5 dark:ring-white/8"
              >
                <button
                  type="button"
                  onClick={() => onSelectEntry(item.id, item.headword)}
                  className="focus-halo flex w-full items-start gap-3 rounded-xl text-left"
                >
                  <Glyph size="lg" className="shrink-0">
                    {item.headword}
                  </Glyph>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-primary">{item.pinyin}</span>
                    {item.traditional !== item.headword ? (
                      <span className="glyph block text-[12px] text-muted-foreground">
                        {item.traditional}
                      </span>
                    ) : null}
                    <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted-foreground">
                      {item.gloss}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "remove-saved", id: item.id })}
                  className={cn(
                    "focus-halo absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-all",
                    "hover:bg-destructive/12 hover:text-destructive group-hover:opacity-100",
                  )}
                  aria-label={`Remove ${item.headword}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <ExportSheet
        open={exporting}
        onOpenChange={setExporting}
        items={state.saved.map((item) => ({
          headword: item.headword,
          traditional: item.traditional,
          pinyin: item.pinyin,
          gloss: item.gloss,
        }))}
      />
    </div>
  );
}
