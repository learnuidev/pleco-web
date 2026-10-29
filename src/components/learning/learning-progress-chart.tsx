"use client";

import { useId } from "react";
import { ColumnChart, type ColumnChartGradient } from "@/components/charts/column-chart";

type Bucket = { percent: number; count: number };

/**
 * The Learning overview chart: every unlocked character bucketed by how much of
 * it is learned. Partial buckets are the accent colour, the 100% bucket is the
 * success colour, so "close to done" and "done" read differently at a glance.
 *
 * Pass `onSelect` to make the columns filters: clicking anywhere in a column
 * selects (or clears) its bucket, however short the bar is.
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
  /** When given, columns are filters: clicking one selects (or clears) its bucket. */
  onSelect?: (percent: number) => void;
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const theme: ColumnChartGradient[] = [
    {
      id: `learn-partial-${gradientId}`,
      stops: [
        { offset: "0%", color: "var(--primary)", opacity: 0.95 },
        { offset: "100%", color: "var(--primary)", opacity: 0.35 },
      ],
    },
    {
      id: `learn-full-${gradientId}`,
      stops: [
        { offset: "0%", color: "var(--success)", opacity: 1 },
        { offset: "100%", color: "var(--success)", opacity: 0.45 },
      ],
    },
    {
      id: `learn-hot-${gradientId}`,
      stops: [
        { offset: "0%", color: "var(--brand)", opacity: 1 },
        { offset: "100%", color: "var(--chart-4)", opacity: 0.8 },
      ],
    },
  ];

  const data: Bucket[] = buckets.map((percent) => ({
    percent,
    count: histogram[percent] ?? 0,
  }));
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <ColumnChart
      title={title}
      subtitle={
        subtitle ??
        `${total} unlocked ${total === 1 ? "character" : "characters"} · by share learned`
      }
      aside={
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
      }
      footnote="% of the character learned"
      data={data}
      xKey="percent"
      yKey="count"
      selected={selected}
      onSelect={
        onSelect
          ? (value: number | string) => {
              onSelect(typeof value === "number" ? value : Number(value));
            }
          : undefined
      }
      formatX={(value) => (value === 100 ? "100" : `${value}`)}
      gradients={theme}
      maxBarSize={26}
      topMargin={12}
      barFill={(bucket, isSelected) =>
        isSelected
          ? `url(#learn-hot-${gradientId})`
          : bucket.percent === 100
            ? `url(#learn-full-${gradientId})`
            : `url(#learn-partial-${gradientId})`
      }
      barOpacity={(bucket) => (bucket.count === 0 ? 0.2 : 1)}
      barLabel={(count) => (count === 0 ? "" : String(count))}
      tooltip={(bucket) => {
        const full = bucket.percent === 100;
        const range = full ? "100% learned" : `${bucket.percent}–${bucket.percent + 10}% learned`;
        return (
          <>
            <p className="font-semibold text-foreground">
              {bucket.count} {bucket.count === 1 ? "character" : "characters"}
            </p>
            <p className="text-muted-foreground">
              {range} · {full ? "fully unlocked" : "partly unlocked"}
            </p>
          </>
        );
      }}
    />
  );
}
