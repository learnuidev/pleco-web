"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookMarked,
  Clock3,
  FileText,
  Search,
  Sun,
  Moon,
  Trash2,
  Type,
  Compass,
} from "lucide-react";

import { useWorkbench, type ViewKey } from "@/components/workbench/state";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV: Array<{ key: ViewKey; label: string; icon: typeof Search; hint: string }> = [
  { key: "dictionary", label: "Dictionary", icon: Search, hint: "Search the dictionary" },
  { key: "text", label: "Text", icon: FileText, hint: "Paste text and read it character by character" },
  { key: "browse", label: "Browse", icon: Compass, hint: "Browse by radical, strokes and frequency" },
  { key: "saved", label: "Saved words", icon: BookMarked, hint: "Your saved words" },
];

export function Sidebar({
  onSelectEntry,
  onSearch,
}: {
  /** Opens an entry; the headword lets the address bar follow along. */
  onSelectEntry: (id: number, headword?: string) => void;
  onSearch: (query: string) => void;
}) {
  const { state, dispatch } = useWorkbench();

  return (
    <aside
      aria-label="Pleco Web navigation"
      className="material hairline-r flex h-full w-[240px] shrink-0 flex-col"
    >
      {/* Traffic-light-ish top inset, purely decorative, keeps the macOS feel */}
      <div className="flex items-center gap-1.5 px-4 pb-2 pt-3.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]/85" />
        <span className="size-2.5 rounded-full bg-[#febc2e]/85" />
        <span className="size-2.5 rounded-full bg-[#28c840]/85" />
        <span className="ml-2 text-[11px] font-semibold tracking-[0.02em] text-muted-foreground">
          Pleco Web
        </span>
      </div>

      <nav className="px-2 pt-1">
        {NAV.map(({ key, label, icon: Icon, hint }) => {
          const active = state.view === key;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "set-view", view: key })}
                  className={cn(
                    "focus-halo relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-foreground/80 hover:bg-foreground/6 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-sidebar-accent"
                      transition={{ type: "spring", stiffness: 520, damping: 40 }}
                    />
                  ) : null}
                  <Icon className="relative size-4" strokeWidth={2.1} />
                  <span className="relative">{label}</span>
                  {key === "saved" && state.saved.length > 0 ? (
                    <span className="tabular relative ml-auto rounded-full bg-foreground/8 px-1.5 py-px text-[10.5px] text-muted-foreground">
                      {state.saved.length}
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{hint}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="hairline-t mx-3 my-2.5" />

      {/* History */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-4 pb-1.5">
          <Clock3 className="size-3.5 text-muted-foreground" />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Recent
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {state.history.length === 0 ? (
            <p className="px-2.5 py-1 text-[11.5px] leading-relaxed text-muted-foreground/80">
              Entries you open show up here.
            </p>
          ) : (
            <ul className="space-y-px">
              {state.history.slice(0, 18).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEntry(item.id, item.headword)}
                    className={cn(
                      "focus-halo flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                      state.selectedId === item.id
                        ? "bg-sidebar-accent"
                        : "hover:bg-foreground/6",
                    )}
                  >
                    <span className="glyph shrink-0 text-[15px]">{item.headword}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] text-primary">
                        {item.pinyin}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {item.gloss}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Saved preview */}
      <AnimatePresence>
        {state.saved.length > 0 ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="hairline-t overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <BookMarked className="size-3.5 text-muted-foreground" />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Saved
              </span>
              <button
                type="button"
                onClick={() => dispatch({ type: "set-view", view: "saved" })}
                className="ml-auto text-[10.5px] text-primary hover:underline"
              >
                all
              </button>
            </div>
            <ul className="max-h-40 space-y-px overflow-y-auto px-2 pb-2">
              {state.saved.slice(0, 8).map((item) => (
                <li key={item.id} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => onSelectEntry(item.id, item.headword)}
                    className="focus-halo flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-foreground/6"
                  >
                    <span className="glyph shrink-0 text-[14px]">{item.headword}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {item.gloss || item.pinyin}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "remove-saved", id: item.id })}
                    className="focus-halo mr-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/12 hover:text-destructive group-hover:opacity-100"
                    aria-label={`Remove ${item.headword}`}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Footer controls */}
      <div className="hairline-t flex items-center gap-1 px-2.5 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-lg"
              onClick={() => dispatch({ type: "toggle-pinyin-marks" })}
              aria-pressed={state.showPinyinMarks}
            >
              <Type className={cn("size-3.5", state.showPinyinMarks && "text-primary")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {state.showPinyinMarks ? "Pinyin: tone marks" : "Pinyin: tone numbers"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-lg"
              onClick={() =>
                dispatch({ type: "set-theme", theme: state.theme === "dark" ? "light" : "dark" })
              }
              aria-label={
                state.theme === "dark" ? "Switch to light appearance" : "Switch to dark appearance"
              }
            >
              {state.theme === "dark" ? (
                <Sun className="size-3.5" />
              ) : (
                <Moon className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {state.theme === "dark" ? "Light appearance" : "Dark appearance"}
          </TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={() => onSearch("你好")}
          className="glyph focus-halo ml-auto rounded-lg px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
          title="Try 你好"
        >
          你好
        </button>
      </div>
    </aside>
  );
}
