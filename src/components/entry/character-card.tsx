"use client";

import { motion } from "framer-motion";
import { Boxes, ChevronRight, GitBranch, Layers, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Glyph } from "@/components/glyph";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Panel } from "@/components/workbench/panel";
import { characterHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { CharacterInfo } from "@/lib/dictionary/types";

const DECOMPOSITION_LEVELS: Array<{ key: keyof CharacterInfo["decomposition"]; label: string; hint: string }> = [
  { key: "once", label: "Once", hint: "First split only" },
  { key: "radical", label: "Radical", hint: "Down to radical components" },
  { key: "graphical", label: "Graphical", hint: "Down to strokes" },
  { key: "primitive", label: "Primitive", hint: "Meaningful building blocks" },
];

/** One character of the headword: decomposition, radical meanings, frequency. */
export function CharacterCard({
  info,
  onSearch,
  className,
}: {
  info: CharacterInfo;
  onSearch: (query: string) => void;
  className?: string;
}) {
  const [level, setLevel] = useState<keyof CharacterInfo["decomposition"]>("primitive");
  const components = info.decomposition[level];

  return (
    <div
      className={cn(
        "rounded-2xl bg-card shadow-raised ring-1 ring-black/5 dark:ring-white/8",
        className,
      )}
    >
      <header className="hairline-b flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => onSearch(info.glyph)}
          className="focus-halo rounded-xl p-1 transition-colors hover:bg-foreground/5"
        >
          <Glyph size="lg" className="text-foreground">
            {info.glyph}
          </Glyph>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-primary">
              {info.pinyin ?? info.readings.slice(0, 3).join(" / ")}
            </span>
            {info.strokeCount ? (
              <span className="tabular rounded-full bg-foreground/6 px-2 py-0.5 text-[11px] text-muted-foreground">
                {info.strokeCount} strokes
              </span>
            ) : null}
            {info.frequency?.rank ? (
              <span className="tabular inline-flex items-center gap-1 rounded-full bg-foreground/6 px-2 py-0.5 text-[11px] text-muted-foreground">
                <TrendingUp className="size-3" />
                #{info.frequency.rank}
              </span>
            ) : null}
          </div>
          {info.definition ? (
            <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground text-pretty">
              {info.definition}
            </p>
          ) : null}
        </div>
      </header>

      <div className="space-y-3.5 p-4">
        {/* Decomposition */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <GitBranch className="size-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Decomposition
            </span>
            <div className="ml-auto flex items-center gap-0.5 rounded-full bg-foreground/6 p-0.5">
              {DECOMPOSITION_LEVELS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  title={option.hint}
                  onClick={() => setLevel(option.key)}
                  className={cn(
                    "focus-halo rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                    level === option.key
                      ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip label={info.glyph} onClick={() => onSearch(info.glyph)} tone="strong" />
            <ChevronRight className="size-3.5 text-muted-foreground/60" />
            {components.length === 0 ? (
              <span className="text-[12px] text-muted-foreground">
                No further decomposition at this level
              </span>
            ) : (
              components.map((component, index) => (
                <Chip
                  key={`${component}-${index}`}
                  label={component}
                  onClick={
                    component === "No glyph available" ? undefined : () => onSearch(component)
                  }
                />
              ))
            )}
          </div>
        </div>

        {/* Components with meaning */}
        {info.components.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Layers className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Components
              </span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {info.components.map((component, index) => (
                <motion.div
                  key={`${component.glyph}-${index}`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02, duration: 0.18 }}
                  className="flex items-center gap-2.5 rounded-xl bg-foreground/4 px-2.5 py-2"
                >
                  <button
                    type="button"
                    disabled={component.glyph === "No glyph available"}
                    onClick={() => onSearch(component.glyph)}
                    className="focus-halo rounded-lg px-1 py-0.5 transition-colors enabled:hover:bg-foreground/8 disabled:opacity-60"
                  >
                    <Glyph size="md" className="text-foreground">
                      {component.glyph === "No glyph available" ? "？" : component.glyph}
                    </Glyph>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {component.meaning ? (
                        <span className="text-[12.5px] font-medium leading-tight">
                          {component.meaning}
                        </span>
                      ) : (
                        <span className="text-[12.5px] italic text-muted-foreground">
                          no gloss
                        </span>
                      )}
                      {component.isRadical && component.radicalNumber ? (
                        <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
                          radical {component.radicalNumber}
                        </span>
                      ) : component.isPrimitive ? (
                        <span className="rounded-full bg-foreground/6 px-1.5 py-px text-[10px] text-muted-foreground">
                          primitive
                        </span>
                      ) : null}
                    </div>
                    {component.usageCount ? (
                      <p className="tabular mt-0.5 text-[11px] text-muted-foreground">
                        in {component.usageCount} characters
                      </p>
                    ) : null}
                  </div>
                  {component.examples.length > 0 ? (
                    <div className="hidden shrink-0 flex-wrap justify-end gap-0.5 sm:flex">
                      {component.examples.slice(0, 5).map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => onSearch(example)}
                          className="glyph focus-halo rounded-md px-1 text-[15px] text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Characters built on this radical / component */}
        {info.usedIn && info.usedIn.total > 0 ? (
          <CharacterUsage glyph={info.glyph} usedIn={info.usedIn} />
        ) : null}

        {/* Phonetic regularity */}
        {info.phoneticGroups.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Phonetic clues
              </span>
            </div>
            <div className="space-y-1.5">
              {info.phoneticGroups.map((group) => (
                <div key={group.reading} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="w-14 shrink-0 font-medium text-primary">{group.reading}</span>
                  {group.matches.slice(0, 6).map((match, index) => (
                    <button
                      key={`${match.component}-${index}`}
                      type="button"
                      onClick={() => onSearch(match.component)}
                      title={regularityTitle(match.regularity, match.componentPinyin)}
                      className={cn(
                        "focus-halo inline-flex items-center gap-1.5 rounded-full py-0.5 pl-1.5 pr-2 transition-colors",
                        regularityTone(match.regularity),
                      )}
                    >
                      <span className="glyph text-[14px]">{match.component}</span>
                      <span className="tabular text-[11px] opacity-80">{match.componentPinyin}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Frequency detail */}
        {info.frequency ? (
          <div className="flex items-center gap-3 rounded-xl bg-foreground/4 px-3 py-2">
            <TrendingUp className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="tabular text-[12px]">
                Frequency rank <span className="font-semibold">#{info.frequency.rank}</span>
                {info.frequency.count ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {info.frequency.count.toLocaleString()} occurrences
                  </span>
                ) : null}
              </p>
              {info.frequency.meaning ? (
                <p className="truncate text-[11px] text-muted-foreground">
                  {info.frequency.meaning}
                </p>
              ) : null}
            </div>
            {info.frequency.rank ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-foreground/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${frequencyBarPercent(info.frequency.rank)}%` }}
                      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                      className="h-full rounded-full bg-primary/70"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  #{info.frequency.rank} of 9,933 ranked characters (log scale)
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        ) : null}

        {/* Words built from this character */}
        {info.wordsWithCharacter.length > 0 ? (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Common words
            </div>
            <div className="flex flex-wrap gap-1">
              {info.wordsWithCharacter.map((word) => (
                <button
                  key={word.id}
                  type="button"
                  onClick={() => onSearch(word.simplified)}
                  className="focus-halo inline-flex items-center gap-1.5 rounded-lg bg-foreground/4 px-2 py-1 text-[12px] transition-colors hover:bg-primary/10"
                >
                  <span className="glyph">{word.simplified}</span>
                  <span className="text-muted-foreground">
                    {word.definition.split("/")[0]?.slice(0, 18)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Maps a Jun Da rank (1..9933) onto 0..100 for the frequency bar. Linear
 * mapping saturates instantly — the top few hundred characters are all within
 * 3% of each other — so the bar uses a log scale where rank 1 fills it.
 */
function frequencyBarPercent(rank: number): number {
  const MAX_RANK = 9933;
  const clamped = Math.min(Math.max(rank, 1), MAX_RANK);
  return Math.max(4, 100 - (Math.log10(clamped) / Math.log10(MAX_RANK)) * 100);
}

const USED_IN_VISIBLE = 36;

/**
 * The reverse view of decomposition: the characters that use this radical or
 * component. Commonest first, each one linking to its own page.
 */
function CharacterUsage({
  glyph,
  usedIn,
}: {
  glyph: string;
  usedIn: NonNullable<CharacterInfo["usedIn"]>;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? usedIn.characters : usedIn.characters.slice(0, USED_IN_VISIBLE);
  const hidden = usedIn.characters.length - shown.length;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Boxes className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Characters using {glyph}
        </span>
        <span className="tabular ml-auto rounded-full bg-foreground/6 px-1.5 py-px text-[10px] text-muted-foreground">
          {usedIn.total}
        </span>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-1">
        {shown.map((character) => (
          <button
            key={character}
            type="button"
            onClick={() => router.push(characterHref(character))}
            title={`Open ${character}`}
            className="glyph focus-halo rounded-lg bg-foreground/4 px-1.5 py-0.5 text-[17px] leading-normal transition-colors hover:bg-primary/12 hover:text-foreground"
          >
            {character}
          </button>
        ))}
        {hidden > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="focus-halo rounded-lg bg-foreground/6 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/12 hover:text-foreground"
          >
            +{hidden} more
          </button>
        ) : null}
      </motion.div>
    </div>
  );
}

function Chip({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick?: () => void;
  tone?: "strong";
}) {
  const isGlyphless = label === "No glyph available";
  const content = (
    <>
      {isGlyphless ? (
        <span className="px-1 text-[11px] italic">no glyph</span>
      ) : (
        <Glyph size="sm">{label}</Glyph>
      )}
    </>
  );

  const classes = cn(
    "inline-flex items-center rounded-lg px-1.5 py-0.5 transition-colors",
    isGlyphless
      ? "bg-foreground/4 text-muted-foreground"
      : tone === "strong"
        ? "bg-primary/12 text-foreground"
        : "bg-foreground/6 hover:bg-primary/12",
  );

  if (!onClick || isGlyphless) return <span className={classes}>{content}</span>;

  return (
    <button type="button" onClick={onClick} className={cn(classes, "focus-halo")}>
      {content}
    </button>
  );
}

/** HanziJS regularity scale: 1 exact, 2 syllable, 3 same initial, 4 same final. */
function regularityTone(regularity: number): string {
  if (regularity === 1) return "bg-success/14 text-success";
  if (regularity === 2) return "bg-primary/12 text-primary";
  if (regularity === 3) return "bg-warning/16 text-warning";
  return "bg-foreground/6 text-muted-foreground";
}

function regularityTitle(regularity: number, pinyin: string): string {
  const label =
    regularity === 1
      ? "exact match (same tone)"
      : regularity === 2
        ? "same syllable, different tone"
        : regularity === 3
          ? "shares the initial"
          : "shares the final";
  return `${pinyin} — ${label}`;
}
