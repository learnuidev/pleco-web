"use client";

import type HanziWriter from "hanzi-writer";
import { useCallback, useEffect, useRef, useState } from "react";

import { Loader2 } from "lucide-react";

import { charDataLoader, isCharacterUnavailable } from "@/lib/stroke-data-client";
import { cn } from "@/lib/utils";

export type StrokeMode = "animate" | "step" | "quiz";

export type HanziCanvasProps = {
  character: string;
  size?: number;
  mode: StrokeMode;
  showOutline: boolean;
  showCharacter: boolean;
  speed?: number;
  delayBetweenStrokes?: number;
  /** Increment to restart the current animation / quiz. */
  runToken?: number;
  onStrokeChange?: (strokeNumber: number | null) => void;
  onQuizComplete?: (mistakes: number) => void;
  onMistake?: () => void;
  className?: string;
  /** Draws the 米字格 practice grid behind the character. */
  grid?: boolean;
  /** Overrides for the writer palette, e.g. for the hero card. */
  colors?: {
    stroke?: string;
    outline?: string;
    radical?: string | null;
    drawing?: string;
    highlight?: string;
  };
};

function readThemeColors(isDark: boolean) {
  return isDark
    ? {
        stroke: "#f2f3f5",
        outline: "#4a4d54",
        drawing: "#5b9cff",
        highlight: "#5b9cff",
      }
    : {
        stroke: "#26282d",
        outline: "#d6d8dd",
        drawing: "#0071e3",
        highlight: "#0071e3",
      };
}

/**
 * Thin React wrapper over hanzi-writer.
 *
 * hanzi-writer owns the SVG inside `divRef` and is imperative, so this component
 * keeps one instance per character and drives it through the small effect
 * contract: create on mount, then react to mode / speed / outline / run-token
 * changes without tearing the instance down.
 */
export function HanziCanvas({
  character,
  size = 112,
  mode,
  showOutline,
  showCharacter,
  speed = 1,
  delayBetweenStrokes = 240,
  runToken = 0,
  onStrokeChange,
  onQuizComplete,
  onMistake,
  className,
  grid = false,
  colors,
}: HanziCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dark, setDark] = useState(false);
  const [strokeCount, setStrokeCount] = useState<number | null>(null);
  const [currentStroke, setCurrentStroke] = useState<number | null>(null);
  const callbacks = useRef({ onStrokeChange, onQuizComplete, onMistake });
  callbacks.current = { onStrokeChange, onQuizComplete, onMistake };

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const palette = readThemeColors(dark);
  const strokeColor = colors?.stroke ?? palette.stroke;
  const outlineColor = colors?.outline ?? palette.outline;
  const drawingColor = colors?.drawing ?? palette.drawing;
  const highlightColor = colors?.highlight ?? palette.highlight;

  /** Creates (or recreates) the writer for a character. */
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    if (isCharacterUnavailable(character)) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    setCurrentStroke(null);

    import("hanzi-writer")
      .then(({ default: HanziWriterClass }) => {
        if (disposed || !hostRef.current) return;
        const element = hostRef.current;
        element.innerHTML = "";

        const writer = HanziWriterClass.create(element, character, {
          width: size,
          height: size,
          padding: Math.round(size * 0.06),
          showOutline,
          showCharacter,
          strokeColor,
          outlineColor,
          drawingColor,
          highlightColor,
          radicalColor: colors?.radical ?? null,
          strokeAnimationSpeed: speed,
          delayBetweenStrokes,
          strokeFadeDuration: 260,
          drawingWidth: Math.max(3, Math.round(size * 0.05)),
          charDataLoader,
          onLoadCharDataSuccess: (data) => {
            if (disposed) return;
            setStrokeCount(data.strokes.length);
            setStatus("ready");
          },
          onLoadCharDataError: () => {
            if (disposed) return;
            setStatus("error");
          },
        });

        writerRef.current = writer;
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      try {
        writerRef.current?.cancelQuiz();
      } catch {
        // writer may already be gone
      }
      writerRef.current = null;
      if (host) host.innerHTML = "";
    };
    // `showOutline` / colours are handled by the update effect below; recreating
    // on every toggle would restart animations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, size]);

  /** Pushes option changes into the live writer without a rebuild. */
  useEffect(() => {
    const writer = writerRef.current;
    if (!writer || status !== "ready") return;
    writer.updateColor("strokeColor", strokeColor);
    writer.updateColor("outlineColor", outlineColor);
    writer.updateColor("drawingColor", drawingColor);
    writer.updateColor("highlightColor", highlightColor);
  }, [strokeColor, outlineColor, drawingColor, highlightColor, status]);

  /** Outline / character visibility toggles. */
  useEffect(() => {
    const writer = writerRef.current;
    if (!writer || status !== "ready") return;
    if (showOutline) void writer.showOutline({ duration: 160 });
    else void writer.hideOutline({ duration: 160 });
    if (showCharacter) void writer.showCharacter({ duration: 160 });
    else void writer.hideCharacter({ duration: 160 });
  }, [showOutline, showCharacter, status]);

  /** Runs the mode. `runToken` lets callers force a replay. */
  useEffect(() => {
    const writer = writerRef.current;
    if (!writer || status !== "ready") return;

    let cancelled = false;

    try {
      writer.cancelQuiz();
    } catch {
      // no active quiz
    }

    if (mode === "quiz") {
      void writer.hideCharacter({ duration: 200 }).then(() => {
        if (cancelled) return;
        void writer.quiz({
          leniency: 1.1,
          showHintAfterMisses: 2,
          highlightOnComplete: true,
          onMistake: () => callbacks.current.onMistake?.(),
          onCorrectStroke: (data) => {
            const strokeNum = (data as unknown as { strokeNum?: number }).strokeNum;
            setCurrentStroke(typeof strokeNum === "number" ? strokeNum + 1 : null);
          },
          onComplete: (summary) => {
            callbacks.current.onQuizComplete?.(summary.totalMistakes);
          },
        });
      });
      return;
    }

    if (mode === "step") {
      // Step mode leaves the character available for per-stroke highlighting;
      // the parent drives animateStroke via the click handler below.
      void writer.showOutline({ duration: 160 });
      return;
    }

    // animate
    setCurrentStroke(null);
    void writer.hideCharacter({ duration: 0 }).then(() => {
      if (cancelled) return;
      void writer.animateCharacter({
        onComplete: () => {
          callbacks.current.onStrokeChange?.(null);
          setCurrentStroke(null);
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mode, runToken, status, speed, delayBetweenStrokes]);

  useEffect(() => {
    callbacks.current.onStrokeChange?.(currentStroke);
  }, [currentStroke]);

  const handleClick = useCallback(() => {
    const writer = writerRef.current;
    if (!writer || status !== "ready") return;
    if (mode === "step") {
      const next = currentStroke === null ? 1 : currentStroke + 1;
      if (strokeCount !== null && next > strokeCount) {
        setCurrentStroke(1);
        void writer.animateStroke(0);
        return;
      }
      setCurrentStroke(next);
      void writer.animateStroke(next - 1);
      return;
    }
    if (mode === "animate") {
      void writer.animateCharacter();
    }
  }, [mode, status, currentStroke, strokeCount]);

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-paper ring-1 ring-black/5 transition-shadow dark:ring-white/10",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {grid ? (
        <div className="tiange-grid pointer-events-none absolute inset-0 opacity-70" />
      ) : null}
      <div
        ref={hostRef}
        onClick={handleClick}
        className={cn(
          "relative h-full w-full",
          mode === "quiz" ? "cursor-crosshair" : "cursor-pointer",
        )}
      />
      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={2.2} />
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 grid place-items-center px-2 text-center">
          <span className="glyph text-[26px] text-muted-foreground/60">{character}</span>
        </div>
      ) : null}
      {mode === "step" && status === "ready" ? (
        <div className="pointer-events-none absolute bottom-1.5 left-0 right-0 text-center text-[10px] font-medium tabular text-muted-foreground">
          {currentStroke === null ? "tap to start" : `${currentStroke} / ${strokeCount ?? "?"}`}
        </div>
      ) : null}
    </div>
  );
}
