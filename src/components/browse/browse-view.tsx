"use client";

import { motion } from "framer-motion";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChartColumn, Hash, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Glyph } from "@/components/glyph";
import { RadicalDistribution } from "@/components/browse/radical-distribution";
import { cn } from "@/lib/utils";

type BrowseItem = {
  character: string;
  pinyin: string;
  meaning: string;
  rank: number | null;
  strokes: number | null;
};

type Axis = "frequency" | "strokes" | "radicals";

type Radical = {
  number: number;
  glyph: string;
  meaning: string;
  strokes: number | null;
  characterCount: number | null;
};

type RadicalSort = "number" | "asc" | "desc";

const AXES: Array<{ key: Axis; label: string }> = [
  { key: "frequency", label: "Most common" },
  { key: "strokes", label: "By strokes" },
  { key: "radicals", label: "Radicals" },
];

const RADICAL_SORTS: Array<{ key: RadicalSort; icon: typeof Hash; label: string; title: string }> = [
  { key: "number", icon: Hash, label: "Kangxi number", title: "Kangxi radical number" },
  { key: "asc", icon: ArrowUpNarrowWide, label: "Fewest strokes", title: "Sort by strokes, ascending" },
  { key: "desc", icon: ArrowDownWideNarrow, label: "Most strokes", title: "Sort by strokes, descending" },
];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-halo tabular rounded-full px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-foreground/6 text-muted-foreground hover:bg-foreground/12",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Browse view: three axes over the same corpus — corpus frequency, stroke count
 * (from the locally mirrored stroke data) and the Kangxi radical inventory.
 *
 * The radical grid supports the usual Pleco moves: filter by stroke count, sort
 * by Kangxi number (default) or by stroke count, and pop the stroke distribution
 * chart open to see the whole inventory at a glance.
 */
export function BrowseView({ onSearch }: { onSearch: (query: string) => void }) {
  const [axis, setAxis] = useState<Axis>("frequency");
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [radicals, setRadicals] = useState<Radical[]>([]);
  const [histogram, setHistogram] = useState<Record<number, number>>({});
  const [strokeFilter, setStrokeFilter] = useState<number>(6);
  const [radicalStrokeFilter, setRadicalStrokeFilter] = useState<number | null>(null);
  const [radicalSort, setRadicalSort] = useState<RadicalSort>("number");
  const [showChart, setShowChart] = useState(false);
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

  const radicalStrokeHistogram = useMemo<Record<number, number>>(() => {
    const counts: Record<number, number> = {};
    for (const radical of radicals) {
      if (!radical.strokes) continue;
      counts[radical.strokes] = (counts[radical.strokes] ?? 0) + 1;
    }
    return counts;
  }, [radicals]);

  const radicalStrokeKeys = useMemo(
    () => Object.keys(radicalStrokeHistogram).map(Number).sort((a, b) => a - b),
    [radicalStrokeHistogram],
  );

  const chartData = useMemo(
    () =>
      radicalStrokeKeys.map((strokes) => ({
        strokes,
        count: radicalStrokeHistogram[strokes] ?? 0,
      })),
    [radicalStrokeKeys, radicalStrokeHistogram],
  );

  /** Filtered and sorted radical grid: Kangxi number order by default. */
  const visibleRadicals = useMemo(() => {
    const filtered =
      radicalStrokeFilter === null
        ? radicals
        : radicals.filter((radical) => radical.strokes === radicalStrokeFilter);
    if (radicalSort === "number") return filtered;
    return [...filtered].sort((a, b) => {
      const diff = (a.strokes ?? 99) - (b.strokes ?? 99);
      if (diff !== 0) return radicalSort === "desc" ? -diff : diff;
      return a.number - b.number;
    });
  }, [radicals, radicalStrokeFilter, radicalSort]);

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
              <FilterChip key={count} active={strokeFilter === count} onClick={() => setStrokeFilter(count)}>
                {count}
              </FilterChip>
            ))}
          </div>
        ) : null}

        {axis === "radicals" ? (
          <>
            <div className="flex flex-wrap items-center gap-1">
              <FilterChip
                active={radicalStrokeFilter === null}
                onClick={() => setRadicalStrokeFilter(null)}
              >
                All
              </FilterChip>
              {radicalStrokeKeys.map((count) => (
                <FilterChip
                  key={count}
                  active={radicalStrokeFilter === count}
                  onClick={() => setRadicalStrokeFilter(count)}
                >
                  {count}
                </FilterChip>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <div className="material hairline-ring flex items-center gap-0.5 rounded-full p-0.5">
                {RADICAL_SORTS.map((option) => {
                  const active = radicalSort === option.key;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      title={option.title}
                      aria-label={option.label}
                      aria-pressed={active}
                      onClick={() => setRadicalSort(option.key)}
                      className={cn(
                        "focus-halo rounded-full px-1.5 py-1 transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                title="Stroke distribution"
                aria-pressed={showChart}
                onClick={() => setShowChart((open) => !open)}
                className={cn(
                  "focus-halo flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  showChart
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground/6 text-muted-foreground hover:bg-foreground/12 hover:text-foreground",
                )}
              >
                <ChartColumn className="size-3.5" />
                Distribution
              </button>
            </div>
          </>
        ) : null}

        {loading ? (
          <Loader2
            className={cn(
              "size-3.5 animate-spin text-muted-foreground",
              axis !== "radicals" && "ml-auto",
            )}
          />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {axis === "radicals" && showChart ? (
          <div className="mb-4">
            <RadicalDistribution
              data={chartData}
              activeStroke={radicalStrokeFilter}
              onSelect={setRadicalStrokeFilter}
            />
          </div>
        ) : null}

        {axis === "radicals" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
            {visibleRadicals.map((radical, index) => (
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
                  <span className="tabular flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                    {radical.strokes ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Hash className="size-2.5" />
                        {radical.strokes}
                      </span>
                    ) : null}
                    <span>#{radical.number}</span>
                    {radical.characterCount ? <span>· {radical.characterCount}</span> : null}
                  </span>
                </span>
              </motion.button>
            ))}
            {visibleRadicals.length === 0 && !loading ? (
              <p className="col-span-full py-8 text-center text-[12.5px] text-muted-foreground">
                Nothing to show for this filter.
              </p>
            ) : null}
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
