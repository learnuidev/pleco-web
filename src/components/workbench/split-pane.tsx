"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SplitPaneProps = {
  left: React.ReactNode;
  right: React.ReactNode;
  storageKey: string;
  defaultWidth?: number;
  min?: number;
  max?: number;
  className?: string;
};

/**
 * Two-pane splitter with a macOS-style hairline divider. The divider widens its
 * hit area on hover (via a pseudo handle) and the pane width is persisted, which
 * is what makes a browser dictionary feel like a native desktop window.
 */
export function SplitPane({
  left,
  right,
  storageKey,
  defaultWidth = 380,
  min = 300,
  max = 620,
  className,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed)) setWidth(Math.min(Math.max(parsed, min), max));
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [storageKey, min, max]);

  useEffect(() => {
    if (!hydrated) return;
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, String(Math.round(width)));
      } catch {
        // ignore
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [width, storageKey, hydrated]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      setDragging(true);

      const move = (moveEvent: PointerEvent) => {
        const next = moveEvent.clientX - bounds.left;
        setWidth(Math.min(Math.max(next, min), Math.min(max, bounds.width - 360)));
      };

      const up = () => {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [min, max],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 48 : 12;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setWidth((value) => Math.max(min, value - step));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setWidth((value) => Math.min(max, value + step));
      }
    },
    [min, max],
  );

  return (
    <div ref={containerRef} className={cn("relative flex min-h-0 flex-1", className)}>
      <div className="flex min-h-0 shrink-0 flex-col" style={{ width }}>
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize results pane"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className={cn(
          "group relative z-20 w-px shrink-0 cursor-col-resize bg-hairline transition-colors",
          "after:absolute after:inset-y-0 after:-left-1.5 after:w-3 after:content-['']",
          dragging ? "bg-primary/60" : "hover:bg-primary/40",
        )}
      >
        <span
          className={cn(
            "absolute left-1/2 top-1/2 h-8 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/15 opacity-0 transition-opacity",
            "group-hover:opacity-100",
            dragging && "opacity-100",
          )}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{right}</div>

      {dragging ? <div className="fixed inset-0 z-30 cursor-col-resize" /> : null}
    </div>
  );
}
