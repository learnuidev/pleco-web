"use client";

import { motion } from "framer-motion";
import { ChartColumn, GraduationCap, Sparkles, Trash2, Unlock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Glyph } from "@/components/glyph";
import { LearningProgressChart } from "@/components/learning/learning-progress-chart";
import { Button } from "@/components/ui/button";
import { useWorkbench } from "@/components/workbench/state";
import { characterHref, isLearningTab, learningHref, type LearningTabKey } from "@/lib/routes";
import { cn } from "@/lib/utils";

type LearnSummary = {
  glyph: string;
  pinyin: string;
  meaning: string;
  rank: number | null;
};

type LearnUnlock = LearnSummary & {
  components: string[];
  learnedComponents: string[];
  missing: string[];
  percent: number;
};

type LearningPayload = {
  learned: LearnSummary[];
  full: LearnUnlock[];
  partial: LearnUnlock[];
  counts: { learned: number; full: number; partial: number };
  /** Unlock counts by learned-percentage bucket (0,10,…,100). */
  histogram: Record<number, number>;
  averagePercent: number;
};

const LEARNING_TAB_LABELS: Array<{ key: LearningTabKey; label: string; icon: typeof GraduationCap }> = [
  { key: "overview", label: "Overview", icon: ChartColumn },
  { key: "learned", label: "Learned", icon: GraduationCap },
  { key: "full", label: "Fully unlocked", icon: Sparkles },
  { key: "partial", label: "Partly unlocked", icon: Unlock },
];

const EMPTY: LearningPayload = {
  learned: [],
  full: [],
  partial: [],
  counts: { learned: 0, full: 0, partial: 0 },
  histogram: {},
  averagePercent: 0,
};

/**
 * `/learning` — what you have marked as learned, and what those radicals unlock.
 *
 * Fully unlocked: every radical of the character has been learned.
 * Partially unlocked: some radicals are learned; the card shows how far along it
 * is and which radicals are still missing (each one links to its own page so it
 * can be learned next).
 */
export function LearningView() {
  const { state, dispatch, openCharacter } = useWorkbench();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: LearningTabKey = isLearningTab(tabParam) ? tabParam : "overview";

  const goToTab = (next: LearningTabKey) => {
    const href = learningHref(next);
    if (`${window.location.pathname}${window.location.search}` !== href) {
      router.push(href, { scroll: false });
    }
  };
  const [payload, setPayload] = useState<LearningPayload>(EMPTY);
  const [loading, setLoading] = useState(false);

  const learnedKey = state.learned.join(",");

  useEffect(() => {
    if (!learnedKey) {
      setPayload(EMPTY);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/learning?learned=${encodeURIComponent(learnedKey)}`)
      .then((response) => (response.ok ? response.json() : EMPTY))
      .then((data: LearningPayload) => {
        if (!cancelled) setPayload(data ?? EMPTY);
      })
      .catch(() => {
        if (!cancelled) setPayload(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [learnedKey]);

  const total = state.learned.length;

  if (total === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-10 text-center">
        <GraduationCap className="size-5 text-muted-foreground" />
        <h2 className="text-[14px] font-semibold">Nothing learned yet</h2>
        <p className="max-w-sm text-[12.5px] leading-relaxed text-muted-foreground text-pretty">
          Open a character or a radical and hit{" "}
          <span className="font-medium text-foreground">Learn</span>. Every component you learn
          unlocks the characters built on it — they show up here, fully or partly unlocked.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-1 rounded-full"
          onClick={() => openCharacter("木")}
        >
          Open 木 and learn it
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hairline-b flex flex-wrap items-center gap-2 px-4 py-2">
        <GraduationCap className="size-3.5 text-muted-foreground" />
        <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {payload.counts.learned} learned
        </span>
        <span className="tabular rounded-full bg-primary/10 px-1.5 py-px text-[10px] text-primary">
          {payload.counts.full} fully unlocked
        </span>
        <span className="tabular rounded-full bg-foreground/6 px-1.5 py-px text-[10px] text-muted-foreground">
          {payload.counts.partial} partly unlocked
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-[12px]"
            onClick={() => dispatch({ type: "clear-learned" })}
          >
            <Trash2 className="size-3.5" />
            <span className="text-destructive">Clear all</span>
          </Button>
        </div>
      </div>

      <div className="hairline-b flex flex-wrap items-center gap-1 px-4 py-1.5">
        {LEARNING_TAB_LABELS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const count =
            key === "overview"
              ? payload.counts.full + payload.counts.partial
              : key === "learned"
                ? total
                : key === "full"
                  ? payload.counts.full
                  : payload.counts.partial;
          return (
            <button
              key={key}
              type="button"
              onClick={() => goToTab(key)}
              aria-pressed={active}
              className={cn(
                "focus-halo relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="learning-tab-pill"
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              ) : null}
              <span className="relative inline-flex items-center gap-1.5">
                <Icon className="size-3.5" />
                {label}
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 py-px text-[10px]",
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-foreground/6",
                  )}
                >
                  {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "overview" ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Learned" value={String(payload.counts.learned)} hint="characters, components & strokes" />
              <StatCard label="Fully unlocked" value={String(payload.counts.full)} hint="every component learned" tone="success" />
              <StatCard label="Partly unlocked" value={String(payload.counts.partial)} hint="in progress" tone="primary" />
              <StatCard label="Average progress" value={`${payload.averagePercent}%`} hint="across your unlocks" />
            </div>

            <LearningProgressChart histogram={payload.histogram} />

            {payload.partial.length > 0 ? (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="size-3.5 text-primary" />
                  <h2 className="text-[12.5px] font-semibold tracking-tight">Closest to unlocked</h2>
                  <span className="text-[10.5px] text-muted-foreground">
                    the partly unlocked characters nearest to done
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {payload.partial.slice(0, 6).map((unlock) => (
                    <PartialCard key={unlock.glyph} unlock={unlock} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {tab === "learned" ? (
          <section>
            <p className="mb-2 text-[10.5px] text-muted-foreground">
              Characters, radicals, primitives and stroke shapes you marked as learned — click any
              one to open it, hover to forget it.
            </p>
            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {payload.learned.map((item) => (
                <div
                  key={item.glyph}
                  className="group relative flex items-center gap-2.5 rounded-xl bg-card px-2.5 py-1.5 shadow-hairline ring-1 ring-black/5 transition-shadow hover:shadow-raised dark:ring-white/8"
                >
                  <button
                    type="button"
                    onClick={() => openCharacter(item.glyph)}
                    className="focus-halo flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left"
                  >
                    <Glyph size="md" className="shrink-0">
                      {item.glyph}
                    </Glyph>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="truncate text-[12.5px] font-medium text-primary">
                          {item.pinyin}
                        </span>
                        {item.rank ? (
                          <span className="tabular shrink-0 rounded-full bg-foreground/6 px-1.5 py-px text-[9.5px] text-muted-foreground">
                            #{item.rank}
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {item.meaning || "—"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Forget ${item.glyph}`}
                    onClick={() => dispatch({ type: "toggle-learned", glyph: item.glyph })}
                    className="focus-halo rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/12 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "full" ? (
          <section>
            <p className="mb-2 text-[10.5px] text-muted-foreground">
              Every component learned — the character is ready to meet.
            </p>
            {payload.full.length > 0 ? (
              <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {payload.full.map((unlock) => (
                  <UnlockRow key={unlock.glyph} unlock={unlock} />
                ))}
              </div>
            ) : (
              <EmptyNote>
                {loading
                  ? "Checking your components…"
                  : "Learn a character's components to unlock it here."}
              </EmptyNote>
            )}
          </section>
        ) : null}

        {tab === "partial" ? (
          <section>
            <p className="mb-2 text-[10.5px] text-muted-foreground">
              Some components learned — finish the highlighted ones to unlock the character.
            </p>
            {payload.partial.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {payload.partial.map((unlock) => (
                  <PartialCard key={unlock.glyph} unlock={unlock} />
                ))}
              </div>
            ) : (
              <EmptyNote>
                {loading ? "Checking your components…" : "No half-finished characters yet."}
              </EmptyNote>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "muted" | "primary" | "success";
}) {
  return (
    <div className="rounded-2xl bg-card px-3 py-2.5 shadow-hairline ring-1 ring-black/5 dark:ring-white/8">
      <p className="text-[10px] uppercase tracking-[0.07em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular text-[20px] font-semibold leading-tight",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
      <p className="truncate text-[10.5px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function UnlockRow({ unlock }: { unlock: LearnUnlock }) {
  const { openCharacter } = useWorkbench();
  return (
    <button
      type="button"
      onClick={() => openCharacter(unlock.glyph)}
      title={`Components: ${unlock.components.join(" ")}`}
      className="focus-halo flex items-center gap-2.5 rounded-xl bg-card px-2.5 py-1.5 text-left shadow-hairline ring-1 ring-black/5 transition-shadow hover:shadow-raised dark:ring-white/8"
    >
      <Glyph size="md" className="shrink-0">
        {unlock.glyph}
      </Glyph>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate text-[12.5px] font-medium text-primary">{unlock.pinyin}</span>
          {unlock.rank ? (
            <span className="tabular shrink-0 rounded-full bg-foreground/6 px-1.5 py-px text-[9.5px] text-muted-foreground">
              #{unlock.rank}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {unlock.meaning || "—"}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-success/14 px-1.5 py-px text-[9.5px] text-success">
        100%
      </span>
    </button>
  );
}

/** Partial unlock: progress toward the character, and the radicals still missing. */
function PartialCard({ unlock }: { unlock: LearnUnlock }) {
  const { openCharacter } = useWorkbench();
  return (
    <div className="rounded-xl bg-card p-2.5 shadow-hairline ring-1 ring-black/5 dark:ring-white/8">
      <button
        type="button"
        onClick={() => openCharacter(unlock.glyph)}
        title={`Components: ${unlock.components.join(" ")}`}
        className="focus-halo flex w-full items-center gap-2.5 rounded-lg text-left"
      >
        <Glyph size="md" className="shrink-0">
          {unlock.glyph}
        </Glyph>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate text-[12.5px] font-medium text-primary">{unlock.pinyin}</span>
            {unlock.rank ? (
              <span className="tabular shrink-0 rounded-full bg-foreground/6 px-1.5 py-px text-[9.5px] text-muted-foreground">
                #{unlock.rank}
              </span>
            ) : null}
          </span>
          <span className="block truncate text-[11.5px] text-muted-foreground">
            {unlock.meaning || "—"}
          </span>
        </span>
        <span className="tabular shrink-0 text-[11px] font-semibold text-primary">
          {unlock.percent}%
        </span>
      </button>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-primary/70 transition-[width] duration-300"
          style={{ width: `${Math.max(4, unlock.percent)}%` }}
        />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">needs</span>
        {unlock.missing.map((radical) => (
          <button
            key={radical}
            type="button"
            onClick={() => openCharacter(radical)}
            title={`Open ${radical} to learn it`}
            className="glyph focus-halo rounded-md bg-foreground/6 px-1.5 py-px text-[13px] text-foreground transition-colors hover:bg-primary/12"
          >
            {radical}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline-strong px-3 py-4 text-center text-[11.5px] text-muted-foreground">
      {children}
    </div>
  );
}
