"use client";

import { motion } from "framer-motion";
import { Hash, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Glyph } from "@/components/glyph";
import { cn } from "@/lib/utils";

type BrowseItem = {
  character: string;
  pinyin: string;
  meaning: string;
  rank: number | null;
  strokes: number | null;
};

type Axis = "frequency" | "strokes" | "radicals";

type Radical = { number: number; glyph: string; meaning: string; characterCount: number | null };

const AXES: Array<{ key: Axis; label: string }> = [
  { key: "frequency", label: "Most common" },
  { key: "strokes", label: "By strokes" },
  { key: "radicals", label: "Radicals" },
];

/**
 * Browse view: three axes over the same corpus — corpus frequency, stroke count
 * (from the locally mirrored stroke data) and the Kangxi radical inventory.
 */
export function BrowseView({ onSearch }: { onSearch: (query: string) => void }) {
  const [axis, setAxis] = useState<Axis>("frequency");
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [radicals, setRadicals] = useState<Radical[]>([]);
  const [histogram, setHistogram] = useState<Record<number, number>>({});
  const [strokeFilter, setStrokeFilter] = useState<number>(6);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextAxis: Axis, strokes: number) => {
      setLoading(true);
      try {
        if (nextAxis === "radicals") {
          const response = await fetch("/api/browse?mode=radicals");
          const data = (await response.json()) as { radicals: Radical[] };
          setRadicals(data.radicals);
        } else if (nextAxis === "strokes") {
          const response = await fetch(`/api/browse?mode=strokes&value=${strokes}`);
          const data = (await response.json()) as {
            items: BrowseItem[];
            strokeHistogram: Record<number, number>;
          };
          setItems(data.items);
          setHistogram(data.strokeHistogram);
        } else {
          const response = await fetch("/api/browse?mode=frequency");
          const data = (await response.json()) as {
            items: BrowseItem[];
            axes: { strokeHistogram: Record<number, number> };
          };
          setItems(data.items);
          setHistogram(data.axes?.strokeHistogram ?? {});
        }
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(axis, strokeFilter);
  }, [axis, strokeFilter, load]);

  const strokeKeys = useMemo(
    () =>
      Object.keys(histogram)
        .map(Number)
        .filter((key) => histogram[key] > 0)
        .sort((a, b) => a - b),
    [histogram],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hairline-b flex flex-wrap items-center gap-2 px-4 py-2">
        <div className="material hairline-ring flex items-center gap-0.5 rounded-full p-0.5">
          {AXES.map((option) => {
            const active = axis === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setAxis(option.key)}
                className={cn(
                  "focus-halo relative rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="browse-axis-pill"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  />
                ) : null}
                <span className="relative">{option.label}</span>
              </button>
            );
          })}
        </div>

        {axis === "strokes" ? (
          <div className="flex flex-wrap items-center gap-1">
            {strokeKeys.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setStrokeFilter(count)}
                className={cn(
                  "focus-halo tabular rounded-full px-2 py-0.5 text-[11px] transition-colors",
                  strokeFilter === count
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground/6 text-muted-foreground hover:bg-foreground/12",
                )}
              >
                {count}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" /> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {axis === "radicals" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
            {radicals.map((radical, index) => (
              <motion.button
                key={radical.number}
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 40) * 0.006 }}
                onClick={() => onSearch(radical.glyph)}
                className="focus-halo group flex items-center gap-2.5 rounded-xl bg-card px-2.5 py-2 text-left shadow-hairline ring-1 ring-black/5 transition-all hover:shadow-raised hover:ring-primary/25 dark:ring-white/8"
              >
                <Glyph size="md" className="shrink-0">
                  {radical.glyph}
                </Glyph>
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] font-medium">{radical.meaning}</span>
                  <span className="tabular block text-[10.5px] text-muted-foreground">
                    #{radical.number}
                    {radical.characterCount ? ` · ${radical.characterCount}` : ""}
                  </span>
                </span>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(122px,1fr))] gap-2">
            {items.map((item, index) => (
              <motion.button
                key={item.character}
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 36) * 0.005 }}
                onClick={() => onSearch(item.character)}
                className="focus-halo group flex flex-col items-center gap-1 rounded-xl bg-card px-2 pb-2 pt-2.5 shadow-hairline ring-1 ring-black/5 transition-all hover:shadow-raised hover:ring-primary/25 dark:ring-white/8"
              >
                <Glyph size="lg" className="text-foreground">
                  {item.character}
                </Glyph>
                <span className="truncate text-[11.5px] font-medium text-primary">{item.pinyin}</span>
                <span className="line-clamp-1 text-center text-[10.5px] text-muted-foreground">
                  {item.meaning || item.character}
                </span>
                <span className="tabular mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                  {item.strokes ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Hash className="size-2.5" />
                      {item.strokes}
                    </span>
                  ) : null}
                  {item.rank ? <span>rank {item.rank}</span> : null}
                </span>
              </motion.button>
            ))}
            {items.length === 0 && !loading ? (
              <p className="col-span-full py-8 text-center text-[12.5px] text-muted-foreground">
                Nothing to show for this filter.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
