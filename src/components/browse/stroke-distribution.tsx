"use client";

import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useId } from "react";

export type StrokeBucket = { strokes: number; count: number };

type TooltipPayload = ReadonlyArray<{ payload?: StrokeBucket }>;

function DistributionTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  unit: "radical" | "character";
}) {
  const bucket = payload?.[0]?.payload;
  if (!active || !bucket) return null;
  return (
    <div className="material-strong rounded-xl px-2.5 py-1.5 text-[11px] shadow-float ring-1 ring-black/5 dark:ring-white/10">
      <p className="font-semibold text-foreground">
        {bucket.count} {bucket.count === 1 ? unit : `${unit}s`}
      </p>
      <p className="text-muted-foreground">
        {bucket.strokes} {bucket.strokes === 1 ? "stroke" : "strokes"}
      </p>
    </div>
  );
}

/**
 * The stroke-count distribution for whichever inventory is on screen: the Kangxi
 * radicals, or the characters in the mirrored stroke data.
 *
 * Gradient bars, animated entrance, a glassy tooltip, and bars that double as
 * filters — clicking one narrows the grid below to that stroke count (a second
 * click clears it).
 */
export function StrokeDistribution({
  data,
  activeStroke,
  onSelect,
  unit,
  title = "Stroke distribution",
}: {
  data: StrokeBucket[];
  activeStroke: number | null;
  onSelect: (strokes: number | null) => void;
  /** What is being counted, singular — used in the totals and the tooltip. */
  unit: "radical" | "character";
  title?: string;
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="material hairline-ring overflow-hidden rounded-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pb-1 pt-3">
        <div>
          <p className="text-[12px] font-semibold tracking-tight">{title}</p>
          <p className="tabular text-[10.5px] text-muted-foreground">
            {total} {total === 1 ? unit : `${unit}s`} · {data.length} stroke counts
          </p>
        </div>
        <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">
          Click a bar to filter
        </span>
      </div>

      <div className="h-[228px] w-full px-1 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id={`stroke-bar-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.45} />
              </linearGradient>
              <linearGradient id={`stroke-bar-hot-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="var(--border)" strokeOpacity={0.7} />
            <XAxis
              dataKey="strokes"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
              content={<DistributionTooltip unit={unit} />}
            />
            <Bar
              dataKey="count"
              radius={[5, 5, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            >
              {data.map((bucket) => {
                const isActive = bucket.strokes === activeStroke;
                const dimmed = activeStroke !== null && !isActive;
                return (
                  <Cell
                    key={bucket.strokes}
                    fill={
                      isActive ? `url(#stroke-bar-hot-${gradientId})` : `url(#stroke-bar-${gradientId})`
                    }
                    fillOpacity={dimmed ? 0.35 : 1}
                    cursor="pointer"
                    onClick={() => onSelect(isActive ? null : bucket.strokes)}
                  />
                );
              })}
              <LabelList
                dataKey="count"
                position="top"
                fill="var(--muted-foreground)"
                fontSize={9}
                offset={4}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="px-3.5 pb-2.5 pt-1 text-right text-[10px] tracking-wide text-muted-foreground/80">
        stroke count
      </p>
    </motion.div>
  );
}
