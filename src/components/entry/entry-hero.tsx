"use client";

import { Bookmark, BookmarkCheck, Copy, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

import { Glyph } from "@/components/glyph";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { splitRuns } from "@/lib/pinyin-client";
import type { EntryDetail } from "@/lib/dictionary/types";
import { cn } from "@/lib/utils";

/**
 * The reader-pane header: oversized headword, tone-marked pinyin, the gloss
 * list, and the actions you reach for constantly (speak, copy, save).
 */
export function EntryHero({
  detail,
  headword,
  alternative,
  saved,
  onToggleSave,
  onSearch,
}: {
  detail: EntryDetail;
  headword: string;
  alternative: string | null;
  saved: boolean;
  onToggleSave: () => void;
  onSearch: (query: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const longest = Math.max(Array.from(headword).length, 1);
  const displaySize = longest === 1 ? "display" : longest === 2 ? "xl" : "lg";

  async function copyEntry() {
    const text = `${headword}\t${detail.pinyin}\t${detail.glosses.join("/")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(headword);
    utterance.lang = "zh-CN";
    utterance.rate = 0.85;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="relative overflow-hidden px-6 pb-5 pt-6">
      {/* Ambient tint derived from the accent, so the hero reads as one surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(60%_100%_at_20%_100%,color-mix(in_oklab,var(--brand)_14%,transparent),transparent)]"
      />

      <div className="relative flex flex-wrap items-start gap-x-6 gap-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="flex flex-col items-center gap-1"
        >
          <button
            type="button"
            onClick={() => onSearch(headword)}
            className="focus-halo rounded-2xl px-3 py-2 transition-colors hover:bg-foreground/4"
            title="Show only this headword"
          >
            <Glyph size={displaySize} className="text-foreground">
              {headword}
            </Glyph>
          </button>
          {alternative ? (
            <button
              type="button"
              onClick={() => onSearch(alternative)}
              className="glyph focus-halo rounded-full px-2 py-0.5 text-[15px] text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
              title="Other script form"
            >
              {alternative}
            </button>
          ) : null}
        </motion.div>

        <div className="min-w-[15rem] flex-1 basis-[22rem]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[22px] font-semibold leading-tight text-primary">
              {detail.pinyin}
            </span>
            {detail.variants.length > 0 ? (
              <span className="text-[13px] text-muted-foreground">
                also {detail.variants.map((variant) => variant.pinyin).join(", ")}
              </span>
            ) : null}
            {detail.frequency?.rank ? (
              <span className="tabular rounded-full bg-foreground/6 px-2 py-0.5 text-[11px] text-muted-foreground">
                rank #{detail.frequency.rank}
              </span>
            ) : null}
            {detail.length === 1 ? (
              <span className="rounded-full bg-foreground/6 px-2 py-0.5 text-[11px] text-muted-foreground">
                single character
              </span>
            ) : null}
          </div>

          <ol className="mt-2.5 space-y-1.5">
            {detail.glosses.map((gloss, index) => (
              <li key={index} className="flex gap-2 text-[13.5px] leading-relaxed">
                <span className="tabular mt-px w-4 shrink-0 text-right text-[11px] text-muted-foreground">
                  {index + 1}
                </span>
                <span className="text-pretty">{renderGloss(gloss, onSearch)}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={speak}
                  disabled={speaking}
                >
                  <Volume2 className={cn("size-3.5", speaking && "animate-pulse")} />
                  <span className="text-[12.5px]">{speaking ? "Speaking…" : "Pronounce"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Uses the browser&apos;s zh-CN speech voice
              </TooltipContent>
            </Tooltip>

            <Button
              variant={saved ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={onToggleSave}
            >
              {saved ? (
                <BookmarkCheck className="size-3.5" />
              ) : (
                <Bookmark className="size-3.5" />
              )}
              <span className="text-[12.5px]">{saved ? "Saved" : "Save"}</span>
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={copyEntry}>
                  <Copy className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{copied ? "Copied" : "Copy entry"}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CEDICT glosses carry parenthesised notes, `CL:` classifiers and `|` separated
 * variant spellings. We keep the text verbatim but turn every Chinese run into a
 * link, the way Pleco lets you tap through a definition.
 */
function renderGloss(gloss: string, onSearch: (query: string) => void) {
  return (
    <>
      {splitRuns(gloss).map((run, index) => {
        if (!run.isHan) {
          return (
            <span key={index} className={run.text.startsWith("(") ? "text-muted-foreground" : undefined}>
              {run.text}
            </span>
          );
        }
        const headword = run.text.replace(/\[[^\]]+\]/g, "");
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSearch(headword)}
            title={`Look up ${headword}`}
            className="glyph focus-halo rounded px-0.5 text-primary hover:bg-primary/10"
          >
            {run.text}
          </button>
        );
      })}
    </>
  );
}
