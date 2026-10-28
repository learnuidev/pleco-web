"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useId } from "react";

export type RadicalStrokeBucket = { strokes: number; count: number };

type TooltipPayload = ReadonlyArray<{ payload?: RadicalStrokeBucket }>;

function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload;
}) {
  const bucket = payload?.[0]?.payload;
  if (!active || !bucket) return null;
  return (
    <div className="material-strong rounded-xl px-2.5 py-1.5 text-[11px] shadow-float ring-1 ring-black/5 dark:ring-white/10">
      <p className="font-semibold text-foreground">
        {bucket.count} {bucket.count === 1 ? "radical" : "radicals"}
      </p>
      <p className="text-muted-foreground">
        {bucket.strokes} {bucket.strokes === 1 ? "stroke" : "strokes"}
      </p>
    </div>
  );
}

/**
 * Sexy little bar chart of the radical inventory: how many radicals need one
 * stroke, two strokes, … The bars are gradient-filled, they animate in, and
 * clicking one filters the grid below to that stroke count.
 */
export function RadicalDistribution({
  data,
  activeStroke,
  onSelect,
}: {
  data: RadicalStrokeBucket[];
  activeStroke: number | null;
  onSelect: (strokes: number | null) => void;
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div className="material hairline-ring overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pb-1 pt-3">
        <div>
          <p className="text-[12px] font-semibold tracking-tight">Stroke distribution</p>
          <p className="tabular text-[10.5px] text-muted-foreground">
            {total} radicals · {data.length} stroke counts
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
              <linearGradient id={`radical-bar-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.45} />
              </linearGradient>
              <linearGradient id={`radical-bar-hot-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
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
              content={<DistributionTooltip />}
            />
            <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={28} animationDuration={700}>
              {data.map((bucket) => {
                const isActive = bucket.strokes === activeStroke;
                const dimmed = activeStroke !== null && !isActive;
                return (
                  <Cell
                    key={bucket.strokes}
                    fill={isActive ? `url(#radical-bar-hot-${gradientId})` : `url(#radical-bar-${gradientId})`}
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
    </div>
  );
}
