"use client";

import { Clock3, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Glyph } from "@/components/glyph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Event = { glyph: string; at: number };

type Step = {
  glyph: string;
  fullNew: string[];
  progressed: Array<{ glyph: string; percent: number; delta: number }>;
  counts: { full: number; partial: number };
};

type TimelineResponse = { steps: Step[]; summary: { learned: number; full: number; partial: number } };

/**
 * The learning time machine: replays the learned glyphs in the order they were
 * acquired and shows, step by step, what each one unlocked (fully) and what it
 * pushed forward (partially).
 */
export function LearningTimeMachine({
  events,
  openCharacter,
}: {
  /** Learned glyphs, oldest first. */
  events: Event[];
  openCharacter: (glyph: string) => void;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const order = useMemo(() => events.map((event) => event.glyph).join(","), [events]);

  useEffect(() => {
    if (!order) {
      setSteps([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/learning?learned=${encodeURIComponent(order)}&timeline=1`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: TimelineResponse | null) => {
        if (cancelled) return;
        setSteps(data?.steps ?? []);
        setIndex((previous) => Math.min(previous, Math.max(0, (data?.steps ?? []).length - 1)));
      })
      .catch(() => {
        if (!cancelled) setSteps([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order]);

  // Auto-play: one learned glyph every 900ms, stopping on the last step.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= steps.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, steps.length]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-hairline-strong px-3 py-6 text-center text-[11.5px] text-muted-foreground">
        Learn something first — the time machine replays every glyph you learn, in order.
      </div>
    );
  }

  const current = steps[index];
  const total = steps.length;
  const at = events[Math.min(index, events.length - 1)]?.at ?? 0;
  const eventGlyph = events[Math.min(index, events.length - 1)]?.glyph ?? "";

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-3 shadow-raised ring-1 ring-black/5 dark:ring-white/8">
        <div className="flex flex-wrap items-center gap-2">
          <Clock3 className="size-3.5 text-muted-foreground" />
          <span className="text-[12.5px] font-semibold tracking-tight">Time machine</span>
          <span className="tabular rounded-full bg-foreground/6 px-1.5 py-px text-[10px] text-muted-foreground">
            step {total === 0 ? 0 : index + 1} / {total}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="First step"
              onClick={() => {
                setPlaying(false);
                setIndex(0);
              }}
            >
              <SkipBack className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Previous step"
              onClick={() => {
                setPlaying(false);
                setIndex((current) => Math.max(0, current - 1));
              }}
            >
              <SkipBack className="size-3.5 rotate-90" />
            </Button>
            <Button
              variant={playing ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => {
                if (!playing && index >= steps.length - 1) setIndex(0);
                setPlaying((value) => !value);
              }}
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              <span className="text-[12px]">{playing ? "Pause" : "Replay"}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Next step"
              onClick={() => {
                setPlaying(false);
                setIndex((current) => Math.min(steps.length - 1, current + 1));
              }}
            >
              <SkipForward className="size-3.5 rotate-90" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Last step"
              onClick={() => {
                setPlaying(false);
                setIndex(Math.max(0, steps.length - 1));
              }}
            >
              <SkipForward className="size-3.5" />
            </Button>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(0, steps.length - 1)}
          value={index}
          onChange={(event) => {
            setPlaying(false);
            setIndex(Number(event.target.value));
          }}
          aria-label="Replay step"
          className="mt-2.5 w-full accent-primary"
        />

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Glyph size="sm" className="text-foreground">
              {eventGlyph}
            </Glyph>
            learned at {at ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
          </span>
          {current ? (
            <>
              <span className="tabular rounded-full bg-primary/10 px-1.5 py-px text-primary">
                {current.counts.full} fully unlocked
              </span>
              <span className="tabular rounded-full bg-foreground/6 px-1.5 py-px">
                {current.counts.partial} partly unlocked
              </span>
            </>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="px-1 text-[11.5px] text-muted-foreground">Rewinding…</p>
      ) : null}

      {current ? (
        <div className="space-y-3">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Unlocked at this step
              </span>
              <span className="tabular rounded-full bg-success/14 px-1.5 py-px text-[9.5px] text-success">
                {current.fullNew.length}
              </span>
            </div>
            {current.fullNew.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {current.fullNew.map((glyph) => (
                  <button
                    key={glyph}
                    type="button"
                    onClick={() => openCharacter(glyph)}
                    className="focus-halo inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-2 py-1 text-[12px] font-medium text-success transition-colors hover:bg-success/16"
                  >
                    <span className="glyph text-[15px] leading-none text-success">{glyph}</span>
                    fully unlocked
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-hairline-strong px-3 py-3 text-center text-[11px] text-muted-foreground">
                No character became fully unlocked with this glyph.
              </p>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Pushed forward
              </span>
              <span className="tabular rounded-full bg-foreground/6 px-1.5 py-px text-[9.5px] text-muted-foreground">
                {current.progressed.length}
              </span>
            </div>
            {current.progressed.length > 0 ? (
              <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {current.progressed.map((entry) => (
                  <button
                    key={entry.glyph}
                    type="button"
                    onClick={() => openCharacter(entry.glyph)}
                    className="focus-halo flex items-center gap-2 rounded-xl bg-foreground/4 px-2 py-1.5 text-left transition-colors hover:bg-primary/8"
                  >
                    <Glyph size="md" className="shrink-0">
                      {entry.glyph}
                    </Glyph>
                    <span className="min-w-0 flex-1">
                      <span className="tabular block text-[11.5px] font-medium text-primary">
                        {entry.percent}%
                      </span>
                      <span className="block h-1 overflow-hidden rounded-full bg-foreground/10">
                        <span
                          className="block h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.max(4, entry.percent)}%` }}
                        />
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-[9.5px] text-success">
                      +{entry.delta}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className={cn("text-[11px] text-muted-foreground", current.fullNew.length === 0 && "hidden")}>
                Nothing else moved.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
