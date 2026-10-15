"use client";

import { cn } from "@/lib/utils";

/**
 * The card surface used throughout the reader pane: a raised white sheet with a
 * hairline ring, an optional title row and generous internal spacing, matching
 * the "grouped inset" look of macOS settings panes.
 */
export function Panel({
  title,
  action,
  children,
  className,
  contentClassName,
  compact,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl bg-card shadow-raised ring-1 ring-black/5 dark:ring-white/8",
        className,
      )}
    >
      {title ? (
        <header className="hairline-b flex items-center gap-2 px-4 py-2.5">
          <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {title}
          </h2>
          {action ? <div className="ml-auto flex items-center gap-1.5">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn(compact ? "p-3" : "p-4", contentClassName)}>{children}</div>
    </section>
  );
}
