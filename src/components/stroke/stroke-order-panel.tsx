"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Gauge,
  Play,
  RotateCcw,
  Ruler,
  Sparkles,
  SquareDashed,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { HanziCanvas, type StrokeMode } from "@/components/stroke/hanzi-canvas";
import { Glyph } from "@/components/glyph";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hanCharacters } from "@/lib/pinyin-client";
import { cn } from "@/lib/utils";

const MODES: Array<{ key: StrokeMode; label: string; icon: typeof Play; hint: string }> = [
  { key: "animate", label: "Animate", icon: Play, hint: "Watch each stroke drawn in order" },
  { key: "step", label: "Step", icon: Ruler, hint: "Advance one stroke at a time" },
  { key: "quiz", label: "Quiz", icon: Target, hint: "Write the character from memory" },
];

const SPEEDS = [
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "1.5×", value: 1.5 },
  { label: "2×", value: 2 },
];

export function StrokeOrderPanel({
  word,
  strokeCounts,
  className,
}: {
  word: string;
  /** Stroke counts keyed by character, from the server-side stroke cache. */
  strokeCounts?: Record<string, number | null>;
  className?: string;
}) {
  const characters = useMemo(() => hanCharacters(word).slice(0, 8), [word]);
  const [mode, setMode] = useState<StrokeMode>("animate");
  const [showOutline, setShowOutline] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [runToken, setRunToken] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quizStats, setQuizStats] = useState<{ mistakes: number; done: number }>({
    mistakes: 0,
    done: 0,
  });

  useEffect(() => {
    setActiveIndex(0);
    setQuizStats({ mistakes: 0, done: 0 });
  }, [word]);

  const size = characters.length <= 1 ? 176 : characters.length === 2 ? 150 : 118;
  const totalStrokes = characters.reduce(
    (sum, character) => sum + (strokeCounts?.[character] ?? 0),
    0,
  );

  if (characters.length === 0) {
    return (
      <div className={cn("rounded-2xl bg-card p-5 text-sm text-muted-foreground", className)}>
        No characters to trace.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="material hairline-ring flex items-center gap-0.5 rounded-full p-0.5">
          {MODES.map(({ key, label, icon: Icon, hint }) => {
            const active = mode === key;
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setMode(key);
                      setRunToken((token) => token + 1);
                      if (key === "quiz") setQuizStats({ mistakes: 0, done: 0 });
                    }}
                    className={cn(
                      "focus-halo relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                      active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="stroke-mode-pill"
                        className="absolute inset-0 rounded-full bg-primary shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
                        transition={{ type: "spring", stiffness: 520, damping: 38 }}
                      />
                    ) : null}
                    <Icon className="relative size-3.5" strokeWidth={2.2} />
                    <span className="relative">{label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{hint}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowOutline((value) => !value)}
                className={cn(
                  "rounded-full",
                  showOutline ? "bg-foreground/8 text-foreground" : "text-muted-foreground",
                )}
                aria-pressed={showOutline}
              >
                <SquareDashed className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {showOutline ? "Hide the outline" : "Show the outline"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground"
                onClick={() => setRunToken((token) => token + 1)}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Replay</TooltipContent>
          </Tooltip>
        </div>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <Gauge className="size-3.5" />
          <div className="flex items-center gap-0.5 rounded-full bg-foreground/6 p-0.5">
            {SPEEDS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSpeed(option.value)}
                className={cn(
                  "focus-halo rounded-full px-2 py-0.5 tabular transition-colors",
                  speed === option.value
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvases */}
      <div className="flex flex-wrap items-start gap-3">
        {characters.map((character, index) => {
          const isActive = index === activeIndex;
          return (
            <div key={`${character}-${index}`} className="flex flex-col items-center gap-1.5">
              <motion.div
                layout
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "rounded-[20px] p-1 transition-colors",
                  isActive ? "bg-primary/10" : "bg-transparent",
                )}
              >
                <HanziCanvas
                  character={character}
                  size={size}
                  mode={mode}
                  showOutline={showOutline && mode !== "quiz"}
                  showCharacter={mode !== "quiz"}
                  speed={speed}
                  delayBetweenStrokes={mode === "animate" ? 220 / speed : 140}
                  runToken={isActive ? runToken : 0}
                  grid={mode === "quiz"}
                  onQuizComplete={(mistakes) =>
                    setQuizStats((stats) => ({ mistakes: stats.mistakes + mistakes, done: stats.done + 1 }))
                  }
                  onMistake={() => setQuizStats((stats) => ({ ...stats, mistakes: stats.mistakes + 1 }))}
                  className={cn(
                    "transition-shadow",
                    isActive ? "shadow-raised ring-primary/25" : "opacity-95",
                  )}
                />
              </motion.div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Glyph size="sm" className="text-foreground/70">
                  {character}
                </Glyph>
                {strokeCounts?.[character] ? (
                  <span className="tabular">{strokeCounts[character]}画</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
          {characters.length} character{characters.length > 1 ? "s" : ""}
        </span>
        {totalStrokes > 0 ? (
          <span className="tabular">Total strokes {totalStrokes}</span>
        ) : null}
        <AnimatePresence mode="popLayout">
          {mode === "quiz" ? (
            <motion.span
              key="quiz-stats"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="inline-flex items-center gap-2"
            >
              <span className="tabular text-foreground">
                {quizStats.done}/{characters.length} completed
              </span>
              <span
                className={cn(
                  "tabular rounded-full px-2 py-0.5",
                  quizStats.mistakes === 0
                    ? "bg-success/12 text-success"
                    : "bg-warning/15 text-warning",
                )}
              >
                {quizStats.mistakes} mistake{quizStats.mistakes === 1 ? "" : "s"}
              </span>
            </motion.span>
          ) : null}
        </AnimatePresence>
        <span className="ml-auto hidden text-muted-foreground/80 sm:inline">
          {mode === "quiz"
            ? "Draw each stroke with the pointer — hanzi-writer grades it live."
            : mode === "step"
              ? "Click a canvas to advance stroke by stroke."
              : "Stroke shapes from the hanzi-writer data set."}
        </span>
      </div>
    </div>
  );
}
