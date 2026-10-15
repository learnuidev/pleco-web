"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Search, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

type Suggestion = {
  value: string;
  kind: "headword" | "pinyin" | "english";
};

/**
 * The dictionary search field: a macOS-style rounded search box with an inline
 * scope hint, debounced autocomplete sourced from the same index the search
 * uses, and keyboard handling (⌘K to focus, ↑/↓/⏎ to pick, esc to clear).
 */
export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder = "Search Chinese, pinyin, or English…",
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const debounced = useDebouncedValue(value, 160);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  /**
   * The suggestion list floats above the results, so it must close on *any*
   * pointer interaction outside the field — otherwise it swallows the click the
   * user aimed at a result row or the sidebar.
   */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const container = containerRef.current;
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        setOpen(false);
        setHighlight(-1);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setHighlight(-1);
      }
    }

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const query = debounced.trim();
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const kind: Suggestion["kind"] = /[\u3400-\u9fff]/.test(query)
      ? "headword"
      : /^[a-zü:\s'1-5]+$/i.test(query)
        ? "pinyin"
        : "english";

    fetch(`/api/suggest?q=${encodeURIComponent(query)}&limit=6`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { suggestions: [] }))
      .then((data: { suggestions: string[] }) => {
        if (cancelled) return;
        setSuggestions(data.suggestions.map((entry) => ({ value: entry, kind })));
      })
      .catch(() => {
        // Suggestions are a progressive enhancement — never block on them.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debounced]);

  function commit(next: string) {
    onChange(next);
    onSubmit?.(next);
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.blur();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open && highlight >= 0 && suggestions[highlight]) commit(suggestions[highlight].value);
      else commit(value);
    } else if (event.key === "Escape") {
      // Escape first dismisses the suggestion list, and only clears the query on
      // a second press — otherwise typing then dismissing wipes the search.
      if (open && suggestions.length > 0) {
        setOpen(false);
        setHighlight(-1);
      } else if (value) {
        onChange("");
      } else {
        inputRef.current?.blur();
      }
    }
  }

  const showSuggestions = open && focused && suggestions.length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-[10px] px-2.5 transition-shadow",
          "material-strong ring-1 ring-black/5 dark:ring-white/10",
          focused && "ring-[1.5px] ring-primary/55",
        )}
      >
        <Search
          className={cn(
            "size-3.5 shrink-0 transition-colors",
            focused ? "text-primary" : "text-muted-foreground",
          )}
          strokeWidth={2.4}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="focus-halo grid size-4 shrink-0 place-items-center rounded-full bg-foreground/12 text-background transition-colors hover:bg-foreground/25"
            aria-label="Clear search"
          >
            <X className="size-2.5" strokeWidth={3} />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-[5px] bg-foreground/6 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            ⌘K
          </kbd>
        )}
      </div>

      <AnimatePresence>
        {showSuggestions ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="material-strong hairline-ring absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl p-1 shadow-float"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.value}-${index}`}
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(suggestion.value);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  highlight === index
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-foreground/6",
                )}
              >
                <Sparkles
                  className={cn(
                    "size-3 shrink-0",
                    highlight === index ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                />
                <span className="glyph truncate">{suggestion.value}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 text-[10.5px]",
                    highlight === index ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {suggestion.kind}
                </span>
                {highlight === index ? (
                  <CornerDownLeft className="size-3 shrink-0 opacity-70" />
                ) : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
