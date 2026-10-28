"use client";

import { motion } from "framer-motion";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowUpRight,
  ChartColumn,
  Hash,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { StrokeDistribution } from "@/components/browse/stroke-distribution";
import { Glyph } from "@/components/glyph";
import { characterHref, syncBrowseUrl, type BrowseAxis } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Axis = BrowseAxis;

type BrowseItem = {
  character: string;
  pinyin: string;
  meaning: string;
  rank: number | null;
  strokes: number | null;
};

type Radical = {
  number: number;
  glyph: string;
  meaning: string;
  pinyin: string;
  strokes: number | null;
  variants: string[];
  examples: string[];
  characterCount: number | null;
};

type CharacterSort = "common" | "rare";
type RadicalSort = "number" | "asc" | "desc";

const AXES: Array<{ key: Axis; label: string }> = [
  { key: "characters", label: "Characters" },
  { key: "radicals", label: "Radicals" },
];

const CHARACTER_SORTS: Array<{ key: CharacterSort; icon: typeof Hash; label: string }> = [
  { key: "common", icon: TrendingUp, label: "Most common" },
  { key: "rare", icon: TrendingDown, label: "Least common" },
];

const RADICAL_SORTS: Array<{ key: RadicalSort; icon: typeof Hash; label: string; title: string }> = [
  { key: "number", icon: Hash, label: "Kangxi number", title: "Kangxi radical number" },
  { key: "asc", icon: ArrowUpNarrowWide, label: "Fewest strokes", title: "Sort by strokes, ascending" },
  { key: "desc", icon: ArrowDownWideNarrow, label: "Most strokes", title: "Sort by strokes, descending" },
];

/** A usable stroke count from the URL, or null when the parameter is junk. */
function strokeParam(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 64 ? value : null;
}

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

/** The three-way "All + every stroke count" row both axes use. */
function StrokeFilterRow({
  keys,
  active,
  onSelect,
}: {
  keys: number[];
  active: number | null;
  onSelect: (value: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <FilterChip active={active === null} onClick={() => onSelect(null)}>
        All
      </FilterChip>
      {keys.map((count) => (
        <FilterChip key={count} active={active === count} onClick={() => onSelect(count)}>
          {count}
        </FilterChip>
      ))}
    </div>
  );
}

function SortPill<T extends string>({
  options,
  active,
  onSelect,
}: {
  options: Array<{ key: T; icon: typeof Hash; label: string; title?: string }>;
  active: T;
  onSelect: (key: T) => void;
}) {
  return (
    <div className="material hairline-ring flex items-center gap-0.5 rounded-full p-0.5">
      {options.map((option) => {
        const isActive = active === option.key;
        const Icon = option.icon;
        return (
          <button
            key={option.key}
            type="button"
            title={option.title ?? option.label}
            aria-label={option.label}
            aria-pressed={isActive}
            onClick={() => onSelect(option.key)}
            className={cn(
              "focus-halo rounded-full px-1.5 py-1 transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

function DistributionToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title="Stroke distribution"
      aria-pressed={open}
      onClick={onToggle}
      className={cn(
        "focus-halo flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
        open
          ? "bg-primary text-primary-foreground"
          : "bg-foreground/6 text-muted-foreground hover:bg-foreground/12 hover:text-foreground",
      )}
    >
      <ChartColumn className="size-3.5" />
      Distribution
    </button>
  );
}

/**
 * Browse view: two inventories over the same corpus.
 *
 * **Characters** — the frequency-ranked characters, filterable by stroke count,
 * ordered most- or least-common first, with a stroke-distribution chart whose
 * bars act as filters.
 *
 * **Radicals** — the Kangxi inventory, with the same filter + chart moves plus
 * sorting by radical number or stroke count.
 *
 * Both share `?tab=…&view=chart&stroke=…&sort=…` so a view is a link.
 */
export function BrowseView() {
  const router = useRouter();
  const params = useSearchParams();

  const [axis, setAxis] = useState<Axis>(() => {
    const tab = params.get("tab");
    return tab === "radicals" || tab === "characters" ? tab : "characters";
  });
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [radicals, setRadicals] = useState<Radical[]>([]);
  const [histogram, setHistogram] = useState<Record<number, number>>({});
  const [charStrokeFilter, setCharStrokeFilter] = useState<number | null>(() =>
    params.get("tab") !== "radicals" ? strokeParam(params.get("stroke")) : null,
  );
  const [charSort, setCharSort] = useState<CharacterSort>(() =>
    params.get("sort") === "rare" ? "rare" : "common",
  );
  const [radicalStrokeFilter, setRadicalStrokeFilter] = useState<number | null>(() =>
    params.get("tab") === "radicals" ? strokeParam(params.get("stroke")) : null,
  );
  const [radicalSort, setRadicalSort] = useState<RadicalSort>(() => {
    const sort = params.get("sort");
    return sort === "asc" || sort === "desc" ? sort : "number";
  });
  // The distribution chart is the default view; `?view=grid` turns it off.
  const [showChart, setShowChart] = useState<boolean>(() => params.get("view") !== "grid");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextAxis: Axis, stroke: number | null, sort: CharacterSort) => {
      setLoading(true);
      try {
        if (nextAxis === "radicals") {
          const response = await fetch("/api/browse?mode=radicals");
          const data = (await response.json()) as { radicals: Radical[] };
          setRadicals(data.radicals);
        } else {
          const search = new URLSearchParams({ mode: "characters", sort });
          if (stroke !== null) search.set("stroke", String(stroke));
          const response = await fetch(`/api/browse?${search.toString()}`);
          const data = (await response.json()) as {
            items: BrowseItem[];
            strokeHistogram: Record<number, number>;
          };
          setItems(data.items);
          setHistogram(data.strokeHistogram);
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
    void load(axis, charStrokeFilter, charSort);
  }, [axis, charStrokeFilter, charSort, load]);

  /** Mirror the axis, chart, filter and sort into `?tab=…&view=…&stroke=…`. */
  useEffect(() => {
    syncBrowseUrl({
      axis,
      chart: showChart,
      stroke: axis === "radicals" ? radicalStrokeFilter : charStrokeFilter,
      sort: axis === "radicals" ? radicalSort : charSort,
    });
  }, [axis, showChart, charStrokeFilter, charSort, radicalStrokeFilter, radicalSort]);

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

  const characterChartData = useMemo(
    () => strokeKeys.map((strokes) => ({ strokes, count: histogram[strokes] ?? 0 })),
    [strokeKeys, histogram],
  );

  const radicalChartData = useMemo(
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

        {axis === "characters" ? (
          <>
            <StrokeFilterRow
              keys={strokeKeys}
              active={charStrokeFilter}
              onSelect={setCharStrokeFilter}
            />
            <div className="ml-auto flex items-center gap-1.5">
              <SortPill options={CHARACTER_SORTS} active={charSort} onSelect={setCharSort} />
              <DistributionToggle open={showChart} onToggle={() => setShowChart((open) => !open)} />
            </div>
          </>
        ) : null}

        {axis === "radicals" ? (
          <>
            <StrokeFilterRow
              keys={radicalStrokeKeys}
              active={radicalStrokeFilter}
              onSelect={setRadicalStrokeFilter}
            />
            <div className="ml-auto flex items-center gap-1.5">
              <SortPill options={RADICAL_SORTS} active={radicalSort} onSelect={setRadicalSort} />
              <DistributionToggle open={showChart} onToggle={() => setShowChart((open) => !open)} />
            </div>
          </>
        ) : null}

      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {showChart ? (
          <div className="mb-4">
            {axis === "radicals" ? (
              <StrokeDistribution
                data={radicalChartData}
                activeStroke={radicalStrokeFilter}
                onSelect={setRadicalStrokeFilter}
                unit="radical"
              />
            ) : (
              <StrokeDistribution
                data={characterChartData}
                activeStroke={charStrokeFilter}
                onSelect={setCharStrokeFilter}
                unit="character"
                title="Characters by stroke count"
              />
            )}
          </div>
        ) : null}

        {axis === "radicals" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-2">
            {visibleRadicals.map((radical, index) => {
              const forms = [radical.glyph, ...radical.variants];
              return (
                <motion.button
                  key={radical.number}
                  type="button"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 40) * 0.006 }}
                  onClick={() => router.push(characterHref(radical.glyph))}
                  title={`${forms.join(" ")} · ${radical.pinyin} — ${radical.meaning}${
                    radical.examples.length > 0 ? ` · ${radical.examples.join(" ")}` : ""
                  }`}
                  className="focus-halo group relative flex flex-col items-center gap-0.5 rounded-xl bg-card px-2 py-2 text-center shadow-hairline ring-1 ring-black/5 transition-all hover:shadow-raised hover:ring-primary/25 dark:ring-white/8"
                >
                  <span className="flex items-baseline justify-center gap-1">
                    <Glyph size="md" className="text-foreground">
                      {radical.glyph}
                    </Glyph>
                    {radical.variants.length > 0 ? (
                      <span className="glyph text-[15px] leading-none text-muted-foreground">
                        {radical.variants.join(" ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="w-full truncate text-[11.5px] font-medium">
                    {radical.meaning}
                  </span>
                  <span className="tabular flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>#{radical.number}</span>
                    {radical.strokes ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Hash className="size-2.5" />
                        {radical.strokes}
                      </span>
                    ) : null}
                    <span className="truncate text-primary/80">{radical.pinyin.split(",")[0]}</span>
                  </span>
                  <ArrowUpRight className="absolute right-1.5 top-1.5 size-3 text-primary/0 transition-colors group-hover:text-primary/70" />
                </motion.button>
              );
            })}
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
                onClick={() => router.push(characterHref(item.character))}
                className="focus-halo group relative flex flex-col items-center gap-1 rounded-xl bg-card px-2 pb-2 pt-2.5 shadow-hairline ring-1 ring-black/5 transition-all hover:shadow-raised hover:ring-primary/25 dark:ring-white/8"
              >
                <ArrowUpRight className="absolute right-1.5 top-1.5 size-3 text-primary/0 transition-colors group-hover:text-primary/70" />
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
                No characters for this filter.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
