"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useId } from "react";

type Bucket = { percent: number; count: number };

type TooltipPayload = ReadonlyArray<{ payload?: Bucket }>;

function BucketTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload }) {
  const bucket = payload?.[0]?.payload;
  if (!active || !bucket) return null;
  const full = bucket.percent === 100;
  const range = full ? "100% learned" : `${bucket.percent}–${bucket.percent + 10}% learned`;
  return (
    <div className="material-strong rounded-xl px-2.5 py-1.5 text-[11px] shadow-float ring-1 ring-black/5 dark:ring-white/10">
      <p className="font-semibold text-foreground">
        {bucket.count} {bucket.count === 1 ? "character" : "characters"}
      </p>
      <p className="text-muted-foreground">
        {range} · {full ? "fully unlocked" : "partly unlocked"}
      </p>
    </div>
  );
}

/**
 * The Learning overview chart: every unlocked character bucketed by how much of
 * it is learned. Partial buckets are the accent colour, the 100% bucket is the
 * success colour, so "close to done" and "done" read differently at a glance.
 */
export function LearningProgressChart({
  histogram,
  title = "Learning progress",
  subtitle,
  buckets = Array.from({ length: 11 }, (_, index) => index * 10),
  selected = null,
  onSelect,
}: {
  histogram: Record<number, number>;
  title?: string;
  subtitle?: string;
  /** Which percentage buckets to show (e.g. 0…90 for partly unlocked). */
  buckets?: number[];
  /** The currently filtered bucket, highlighted. */
  selected?: number | null;
  /** When given, bars are filters: clicking one selects (or clears) its bucket. */
  onSelect?: (percent: number) => void;
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, "");

  const data: Bucket[] = buckets.map((percent) => ({
    percent,
    count: histogram[percent] ?? 0,
  }));
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div className="material hairline-ring overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pb-1 pt-3">
        <div>
          <p className="text-[12px] font-semibold tracking-tight">{title}</p>
          <p className="tabular text-[10.5px] text-muted-foreground">
            {subtitle ?? `${total} unlocked ${total === 1 ? "character" : "characters"} · by share learned`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-primary" />
            partly unlocked
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-success" />
            fully unlocked
          </span>
        </div>
      </div>

      <div className="h-[236px] w-full px-1 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id={`learn-partial-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id={`learn-full-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0.45} />
              </linearGradient>
              <linearGradient id={`learn-hot-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="var(--border)" strokeOpacity={0.7} />
            <XAxis
              dataKey="percent"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickFormatter={(value: number) => (value === 100 ? "100" : `${value}`)}
            />
            <Tooltip cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }} content={<BucketTooltip />} />
            <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive={false}>
              {data.map((bucket) => {
                const isActive = bucket.percent === selected;
                return (
                  <Cell
                    key={bucket.percent}
                    fill={
                      isActive
                        ? `url(#learn-hot-${gradientId})`
                        : bucket.percent === 100
                          ? `url(#learn-full-${gradientId})`
                          : `url(#learn-partial-${gradientId})`
                    }
                    fillOpacity={bucket.count === 0 ? 0.2 : 1}
                    cursor={onSelect ? "pointer" : undefined}
                    onClick={onSelect ? () => onSelect(bucket.percent) : undefined}
                  />
                );
              })}
              <LabelList
                dataKey="count"
                position="top"
                fill="var(--muted-foreground)"
                fontSize={9}
                offset={4}
                formatter={(value) => (value === 0 ? "" : String(value))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="px-3.5 pb-2.5 pt-1 text-right text-[10px] tracking-wide text-muted-foreground/80">
        % of the character learned
      </p>
    </div>
  );
}
