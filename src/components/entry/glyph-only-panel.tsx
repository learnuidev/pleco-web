"use client";

import { GraduationCap, Layers, Link2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Glyph } from "@/components/glyph";
import { Button } from "@/components/ui/button";
import { useWorkbench } from "@/components/workbench/state";
import type { CharacterInfo } from "@/lib/dictionary/types";
import { characterHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

type ComponentIndex = {
  glyph: string;
  exists: boolean;
  isRadical: boolean;
  radicalMeaning: string | null;
  count?: number;
};

type BrowseRow = {
  character: string;
  pinyin: string;
  meaning: string;
  rank: number | null;
  strokes: number | null;
};

const VISIBLE = 60;

/**
 * The reader for a glyph that has no CC-CEDICT entry — stroke symbols (㇉ ㇆)
 * and bare components. There is no definition to show, but the glyph is still a
 * first-class citizen: it can be learned, its own components are listed, and the
 * characters that use it are linked.
 */
export function GlyphOnlyPanel({ glyph }: { glyph: string }) {
  const { state, dispatch, openCharacter } = useWorkbench();
  const [info, setInfo] = useState<CharacterInfo | null>(null);
  const [index, setIndex] = useState<ComponentIndex | null>(null);
  const [characters, setCharacters] = useState<BrowseRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  const learned = state.learned.includes(glyph);
  const isStroke = (glyph.codePointAt(0) ?? 0) >= 0x31c0 && (glyph.codePointAt(0) ?? 0) <= 0x31ef;

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setIndex(null);

    fetch(`/api/character/${encodeURIComponent(glyph)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: CharacterInfo | null) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => undefined);
    fetch(`/api/component/${encodeURIComponent(glyph)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ComponentIndex | null) => {
        if (!cancelled) setIndex(data);
      })
      .catch(() => undefined);
    fetch(`/api/browse?mode=component&value=${encodeURIComponent(glyph)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { items: BrowseRow[] } | null) => {
        if (!cancelled) setCharacters(data?.items ?? []);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [glyph]);

  const shown = expanded ? characters : characters.slice(0, VISIBLE);
  const hidden = characters.length - shown.length;
  const components = info?.components ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-start gap-5 rounded-2xl bg-card p-4 shadow-raised ring-1 ring-black/5 dark:ring-white/8">
          <div className="grid min-h-[96px] min-w-[96px] place-items-center rounded-2xl border border-dashed border-border bg-paper/60 px-3 tiange-grid">
            <Glyph size="xl" className="text-foreground">
              {glyph}
            </Glyph>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold">
                {isStroke ? "Stroke shape" : "Building block"}
              </h2>
              {index?.isRadical && index.radicalMeaning ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary">
                  radical · {index.radicalMeaning}
                </span>
              ) : null}
              {characters.length > 0 ? (
                <span className="tabular rounded-full bg-foreground/6 px-2 py-0.5 text-[10.5px] text-muted-foreground">
                  used in {characters.length} character{characters.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground text-pretty">
              {isStroke
                ? "A stroke shape from the CJK Strokes block. It has no dictionary entry of its own, but it appears in the decomposition of real characters — open one below, or learn it to track it."
                : "This glyph has no CC-CEDICT entry. It still works as a building block: open the characters that use it, or learn it to track it."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Button
                variant={learned ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => dispatch({ type: "toggle-learned", glyph })}
              >
                <GraduationCap className="size-3.5" />
                <span className="text-[12.5px]">{learned ? "Learned" : "Learn"}</span>
              </Button>
            </div>
          </div>
        </div>

        {components.length > 0 ? (
          <section>
            <SectionHeading icon={Layers} title="Made of" count={components.length} />
            <div className="flex flex-wrap gap-1.5">
              {components.map((component) => (
                <button
                  key={component.glyph}
                  type="button"
                  onClick={() => openCharacter(component.glyph)}
                  title={`${component.meaning || component.glyph} — used in ${
                    component.usageCount ?? 0
                  } characters`}
                  className="focus-halo flex items-center gap-1.5 rounded-lg bg-foreground/4 px-2 py-1 text-[12.5px] transition-colors hover:bg-primary/10"
                >
                  <span className="glyph text-[16px] leading-none">{component.glyph}</span>
                  <span className="text-muted-foreground">{component.meaning || "—"}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionHeading
            icon={Link2}
            title="Characters using it"
            count={characters.length}
            tone="primary"
          />
          {characters.length > 0 ? (
            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((row) => (
                <button
                  key={row.character}
                  type="button"
                  onClick={() => openCharacter(row.character)}
                  title={`Open ${row.character}`}
                  className="focus-halo flex items-center gap-2.5 rounded-xl bg-foreground/4 px-2 py-1.5 text-left transition-colors hover:bg-primary/8"
                >
                  <Glyph size="md" className="shrink-0">
                    {row.character}
                  </Glyph>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-[12px] font-medium text-primary">
                        {row.pinyin || "—"}
                      </span>
                      {row.rank ? (
                        <span className="tabular shrink-0 rounded-full bg-foreground/6 px-1.5 py-px text-[9.5px] text-muted-foreground">
                          #{row.rank}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {row.meaning || "—"}
                    </span>
                  </span>
                </button>
              ))}
              {hidden > 0 ? (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="focus-halo flex items-center justify-center rounded-xl bg-foreground/6 px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/12 hover:text-foreground"
                >
                  +{hidden} more
                </button>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-hairline-strong px-3 py-4 text-center text-[11.5px] text-muted-foreground">
              No character in the database is built on this glyph.
            </p>
          )}
        </section>

        <p className="text-[10.5px] text-muted-foreground/70">
          Decomposition data from HanziJS · this glyph is not in CC-CEDICT
        </p>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  count,
  tone = "muted",
}: {
  icon: typeof Layers;
  title: string;
  count: number;
  tone?: "muted" | "primary";
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className={cn("size-3.5", tone === "primary" ? "text-primary" : "text-muted-foreground")} />
      <h3 className="text-[12px] font-semibold tracking-tight">{title}</h3>
      <span
        className={cn(
          "tabular rounded-full px-1.5 py-px text-[10px]",
          tone === "primary" ? "bg-primary/10 text-primary" : "bg-foreground/6 text-muted-foreground",
        )}
      >
        {count}
      </span>
    </div>
  );
}
