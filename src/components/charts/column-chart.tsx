"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";

/** One gradient a chart can paint bars with, e.g. a normal and a selected ramp. */
export type ColumnChartGradient = {
  id: string;
  stops: Array<{ offset: string; color: string; opacity?: number }>;
};

type ChartClickState = { activeTooltipIndex?: number | string | null };

/** The payload recharts hands to a custom tooltip renderer. */
type TooltipPayload = ReadonlyArray<{ payload?: unknown }>;

/**
 * The filterable column chart every distribution in the app is built from: a
 * glassy card around a gradient bar chart whose columns double as filters.
 *
 * The whole column is the click target — recharts resolves the hovered category
 * from the pointer's x position across the full plot area, so a bar one pixel
 * tall is as easy to hit as a tall one. Each chart supplies its own gradients,
 * tooltip and header copy; the click plumbing, tooltip shell and card chrome
 * live here, so that behaviour changes in one place.
 */
export function ColumnChart<D>({
  title,
  subtitle,
  aside,
  footnote,
  data,
  xKey,
  yKey,
  selected = null,
  onSelect,
  formatX,
  gradients = [],
  barFill,
  barOpacity,
  barLabel,
  tooltip,
  height = 228,
  maxBarSize = 28,
  topMargin = 10,
  animateIn = false,
  filterHint = false,
}: {
  title: string;
  subtitle: ReactNode;
  /** Right-hand side of the header: a badge or a legend. */
  aside?: ReactNode;
  /** Axis caption under the chart. */
  footnote?: string;
  data: D[];
  /** The field that identifies a column — the value reported by `onSelect`. */
  xKey: keyof D & string;
  /** The field holding the column height. */
  yKey: keyof D & string;
  /** The currently filtered column value, highlighted. */
  selected?: number | string | null;
  /** When given, clicking anywhere in a column selects it. */
  onSelect?: (value: number | string, datum: D) => void;
  formatX?: (value: number | string) => string;
  gradients?: ColumnChartGradient[];
  barFill: (datum: D, isSelected: boolean) => string;
  /** Fill opacity, e.g. to fade the columns a filter rules out. */
  barOpacity?: (datum: D, isSelected: boolean) => number;
  /** Turn the value label on top of each bar into text (empty string hides it). */
  barLabel?: (value: number) => string;
  tooltip: (datum: D) => ReactNode;
  height?: number;
  maxBarSize?: number;
  topMargin?: number;
  animateIn?: boolean;
  filterHint?: boolean;
}) {
  const handleClick = (state: ChartClickState) => {
    if (!onSelect) return;
    // recharts reports the column under the pointer for any point inside the
    // plot area, not just points over a drawn bar.
    const raw = state?.activeTooltipIndex;
    if (raw === null || raw === undefined) return;
    const index = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(index) || index < 0 || index >= data.length) return;
    const datum = data[index];
    const value = datum[xKey];
    if (typeof value !== "number" && typeof value !== "string") return;
    onSelect(value, datum);
  };

  const TooltipContent = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: TooltipPayload;
  }) => {
    const datum = payload?.[0]?.payload as D | undefined;
    if (!active || !datum) return null;
    return (
      <div className="material-strong rounded-xl px-2.5 py-1.5 text-[11px] shadow-float ring-1 ring-black/5 dark:ring-white/10">
        {tooltip(datum)}
      </div>
    );
  };

  const card = (
    <div className="material hairline-ring overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pb-1 pt-3">
        <div>
          <p className="text-[12px] font-semibold tracking-tight">{title}</p>
          <p className="tabular text-[10.5px] text-muted-foreground">{subtitle}</p>
        </div>
        {aside ?? (filterHint ? <FilterHint /> : null)}
      </div>

      <div className="w-full px-1 pt-1" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: topMargin, right: 12, bottom: 0, left: 12 }}
            onClick={onSelect ? handleClick : undefined}
            cursor={onSelect ? "pointer" : undefined}
          >
            <defs>
              {gradients.map((gradient) => (
                <linearGradient key={gradient.id} id={gradient.id} x1="0" y1="0" x2="0" y2="1">
                  {gradient.stops.map((stop) => (
                    <stop
                      key={stop.offset}
                      offset={stop.offset}
                      stopColor={stop.color}
                      stopOpacity={stop.opacity ?? 1}
                    />
                  ))}
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="var(--border)" strokeOpacity={0.7} />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickFormatter={formatX ? (value: number | string) => formatX(value) : undefined}
            />
            <Tooltip
              cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
              content={<TooltipContent />}
            />
            <Bar dataKey={yKey} radius={[5, 5, 0, 0]} maxBarSize={maxBarSize} isAnimationActive={false}>
              {data.map((datum, index) => {
                const value = datum[xKey];
                const isSelected = selected !== null && value === selected;
                return (
                  <Cell
                    key={typeof value === "number" || typeof value === "string" ? value : index}
                    fill={barFill(datum, isSelected)}
                    fillOpacity={barOpacity ? barOpacity(datum, isSelected) : 1}
                  />
                );
              })}
              <LabelList
                dataKey={yKey}
                position="top"
                fill="var(--muted-foreground)"
                fontSize={9}
                offset={4}
                formatter={
                  barLabel
                    ? (value: unknown) => barLabel(typeof value === "number" ? value : 0)
                    : undefined
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {footnote ? (
        <p className="px-3.5 pb-2.5 pt-1 text-right text-[10px] tracking-wide text-muted-foreground/80">
          {footnote}
        </p>
      ) : null}
    </div>
  );

  if (!animateIn) return card;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
    >
      {card}
    </motion.div>
  );
}

function FilterHint() {
  return (
    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">
      Click a column to filter
    </span>
  );
}
