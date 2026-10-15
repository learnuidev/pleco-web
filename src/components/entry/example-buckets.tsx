"use client";

import { motion } from "framer-motion";

import { Panel } from "@/components/workbench/panel";
import { useWorkbench } from "@/components/workbench/state";
import type { CharacterBucket, RelatedEntry } from "@/lib/dictionary/types";
import { Glyph } from "@/components/glyph";
import { cn } from "@/lib/utils";

const TIER_META: Record<CharacterBucket["tier"], { label: string; className: string }> = {
  common: { label: "Common", className: "bg-success/12 text-success" },
  uncommon: { label: "Less common", className: "bg-warning/16 text-warning" },
  rare: { label: "Rare", className: "bg-foreground/6 text-muted-foreground" },
};

/** Example words grouped by how often they turn up in the Leiden corpus. */
export function ExampleBuckets({
  buckets,
  onSearch,
}: {
  buckets: CharacterBucket[];
  onSearch: (query: string) => void;
}) {
  const { headword } = useWorkbench();

  if (buckets.length === 0) {
    return (
      <Panel title="Example words">
        <p className="text-[12.5px] text-muted-foreground">
          No ranked example words in the corpus for this entry.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => {
        const meta = TIER_META[bucket.tier];
        return (
          <Panel
            key={bucket.tier}
            title={
              <span className="flex items-center gap-2">
                Examples
                <span className={cn("rounded-full px-1.5 py-px text-[10px] normal-case tracking-normal", meta.className)}>
                  {meta.label}
                </span>
              </span>
            }
            compact
            contentClassName="p-1.5"
          >
            <ul className="grid gap-0.5 sm:grid-cols-2">
              {bucket.entries.map((entry, index) => (
                <motion.li
                  key={`${entry.id}-${entry.simplified}-${index}`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 10) * 0.012, duration: 0.16 }}
                >
                  <button
                    type="button"
                    onClick={() => onSearch(entry.simplified)}
                    className="focus-halo flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-primary/8"
                  >
                    <Glyph size="sm" className="text-foreground">
                      {headword(entry)}
                    </Glyph>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] leading-tight text-muted-foreground">
                        {entry.definition.split("/").filter(Boolean).slice(0, 2).join("; ")}
                      </span>
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}

/** Words that share characters with the current entry — the "see also" rail. */
export function RelatedList({
  related,
  onSearch,
  title = "Related words",
}: {
  related: RelatedEntry[];
  onSearch: (query: string) => void;
  title?: string;
}) {
  const { headword } = useWorkbench();

  if (related.length === 0) {
    return (
      <Panel title={title}>
        <p className="text-[12.5px] text-muted-foreground">Nothing closely related in CEDICT.</p>
      </Panel>
    );
  }

  return (
    <Panel title={title} compact contentClassName="p-1.5">
      <ul className="grid gap-0.5 sm:grid-cols-2">
        {related.map((item, index) => (
          <motion.li
            key={`${item.entry.id}-${index}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 12) * 0.01, duration: 0.16 }}
          >
            <button
              type="button"
              onClick={() => onSearch(item.entry.simplified)}
              className="focus-halo flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-primary/8"
            >
              <Glyph size="sm" className="mt-px text-foreground">
                {headword(item.entry)}
              </Glyph>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-[11.5px] font-medium text-primary">
                    {item.pinyin}
                  </span>
                  {item.relation === "compound" ? (
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      compound
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-[11.5px] leading-tight text-muted-foreground">
                  {item.entry.definition.split("/").filter(Boolean).slice(0, 2).join("; ")}
                </span>
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </Panel>
  );
}
