"use client";

import { useId } from "react";
import { ColumnChart, type ColumnChartGradient } from "@/components/charts/column-chart";

export type StrokeBucket = { strokes: number; count: number };

const UNIT_LABEL = { radical: "radical", character: "character", component: "component" } as const;

/**
 * The stroke-count distribution for whichever inventory is on screen: the Kangxi
 * radicals, or the characters in the mirrored stroke data.
 *
 * Gradient bars that double as filters — clicking anywhere in a column narrows
 * the grid below to that stroke count (a second click clears it), which keeps
 * one- and two-stroke buckets as easy to hit as the fat middle of the curve.
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
  unit: "radical" | "character" | "component";
  title?: string;
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const theme: ColumnChartGradient[] = [
    {
      id: `stroke-bar-${gradientId}`,
      stops: [
        { offset: "0%", color: "var(--chart-1)", opacity: 0.95 },
        { offset: "100%", color: "var(--chart-5)", opacity: 0.45 },
      ],
    },
    {
      id: `stroke-bar-hot-${gradientId}`,
      stops: [
        { offset: "0%", color: "var(--brand)", opacity: 1 },
        { offset: "100%", color: "var(--chart-4)", opacity: 0.8 },
      ],
    },
  ];
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);
  const label = UNIT_LABEL[unit];

  return (
    <ColumnChart
      title={title}
      subtitle={`${total} ${total === 1 ? label : `${label}s`} · ${data.length} stroke counts`}
      footnote="stroke count"
      filterHint
      animateIn
      data={data}
      xKey="strokes"
      yKey="count"
      selected={activeStroke}
      onSelect={(value) => {
        const strokes = typeof value === "number" ? value : Number(value);
        onSelect(activeStroke === strokes ? null : strokes);
      }}
      gradients={theme}
      barFill={(bucket, isSelected) =>
        isSelected ? `url(#stroke-bar-hot-${gradientId})` : `url(#stroke-bar-${gradientId})`
      }
      barOpacity={(_, isSelected) => (activeStroke !== null && !isSelected ? 0.35 : 1)}
      tooltip={(bucket) => (
        <>
          <p className="font-semibold text-foreground">
            {bucket.count} {bucket.count === 1 ? label : `${label}s`}
          </p>
          <p className="text-muted-foreground">
            {bucket.strokes} {bucket.strokes === 1 ? "stroke" : "strokes"}
          </p>
        </>
      )}
    />
  );
}
