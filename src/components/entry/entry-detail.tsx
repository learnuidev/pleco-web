"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, Hash, Info, Layers, Loader2, PenLine, Quote } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CharacterCard } from "@/components/entry/character-card";
import { EntryHero } from "@/components/entry/entry-hero";
import { ExampleBuckets, RelatedList } from "@/components/entry/example-buckets";
import { Panel } from "@/components/workbench/panel";
import { StrokeOrderPanel } from "@/components/stroke/stroke-order-panel";
import { useWorkbench, type SavedItem } from "@/components/workbench/state";
import type { EntryDetail } from "@/lib/dictionary/types";
import { cn } from "@/lib/utils";

type TabKey = "strokes" | "characters" | "examples" | "details";

const TABS: Array<{ key: TabKey; label: string; icon: typeof PenLine }> = [
  { key: "strokes", label: "Strokes", icon: PenLine },
  { key: "characters", label: "Characters", icon: Layers },
  { key: "examples", label: "Examples", icon: Quote },
  { key: "details", label: "Details", icon: Info },
];

export function EntryDetailPane({
  entryId,
  onSearch,
  onSelectEntry,
}: {
  entryId: number | null;
  onSearch: (query: string) => void;
  onSelectEntry: (id: number) => void;
}) {
  const { state, dispatch, headword, traditionalHint } = useWorkbench();
  const [detail, setDetail] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("strokes");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (entryId === null) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/entry/${entryId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load entry (${response.status})`);
        return (await response.json()) as EntryDetail;
      })
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setLoading(false);
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entryId]);

  /** Record the visit in history once the entry resolves. */
  useEffect(() => {
    if (!detail) return;
    dispatch({
      type: "push-history",
      item: {
        id: detail.entry.id,
        headword: detail.entry.simplified,
        pinyin: detail.pinyin,
        gloss: detail.glosses[0] ?? "",
        at: Date.now(),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.entry.id]);

  const isSaved = useMemo(
    () => (detail ? state.saved.some((item) => item.id === detail.entry.id) : false),
    [state.saved, detail],
  );

  const strokeCounts = useMemo(() => {
    if (!detail) return undefined;
    const counts: Record<string, number | null> = {};
    for (const character of detail.characters) counts[character.glyph] = character.strokeCount;
    return counts;
  }, [detail]);

  if (entryId === null) {
    return <Placeholder />;
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <div>
          <p className="text-[13px] font-medium text-destructive">{error}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            The entry id may no longer exist in this CEDICT snapshot.
          </p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className={cn("size-5 text-muted-foreground", loading && "animate-spin")} />
      </div>
    );
  }

  const label = headword(detail.entry);
  const alt = traditionalHint(detail.entry);

  function toggleSave() {
    if (!detail) return;
    const item: SavedItem = {
      id: detail.entry.id,
      headword: detail.entry.simplified,
      traditional: detail.entry.traditional,
      pinyin: detail.pinyin,
      gloss: detail.glosses[0] ?? "",
      addedAt: Date.now(),
    };
    dispatch({ type: "toggle-save", item });
  }

  return (
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={detail.entry.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
        >
          <EntryHero
            detail={detail}
            headword={label}
            alternative={alt}
            saved={isSaved}
            onToggleSave={toggleSave}
            onSearch={onSearch}
          />

          {/* Tab bar: segmented, macOS style */}
          <div className="sticky top-0 z-20 material hairline-b">
            <div className="flex items-center gap-0.5 px-4 py-1.5">
              {TABS.map(({ key, label: tabLabel, icon: Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={cn(
                      "focus-halo relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={2.2} />
                    {tabLabel}
                    {active ? (
                      <motion.span
                        layoutId="entry-tab-underline"
                        className="absolute inset-x-1.5 -bottom-[7px] h-[2px] rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 480, damping: 36 }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.16 }}
              >
                {tab === "strokes" ? (
                  <div className="space-y-4">
                    <Panel
                      title="Stroke order"
                      action={
                        <span className="text-[11px] text-muted-foreground">
                          hanzi-writer data · offline cache
                        </span>
                      }
                    >
                      <StrokeOrderPanel
                        word={detail.entry.simplified}
                        strokeCounts={strokeCounts}
                      />
                    </Panel>
                    <RelatedList related={detail.related} onSearch={onSearch} />
                  </div>
                ) : null}

                {tab === "characters" ? (
                  <div className="space-y-4">
                    {detail.characters.map((info) => (
                      <CharacterCard key={info.glyph} info={info} onSearch={onSearch} />
                    ))}
                    {detail.contains.length > 0 ? (
                      <Panel title="Words containing this character" compact contentClassName="p-1.5">
                        <ul className="grid gap-0.5 sm:grid-cols-2">
                          {detail.contains.map((item) => (
                            <li key={item.entry.id}>
                              <button
                                type="button"
                                onClick={() => onSearch(item.entry.simplified)}
                                className="focus-halo flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-primary/8"
                              >
                                <span className="glyph text-[17px]">{item.entry.simplified}</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[11.5px] text-primary">
                                    {item.pinyin}
                                  </span>
                                  <span className="block truncate text-[11.5px] text-muted-foreground">
                                    {item.entry.definition.split("/")[0]}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    ) : null}
                  </div>
                ) : null}

                {tab === "examples" ? (
                  <div className="space-y-4">
                    <ExampleBuckets buckets={detail.examples} onSearch={onSearch} />
                    <RelatedList related={detail.related} onSearch={onSearch} />
                  </div>
                ) : null}

                {tab === "details" ? (
                  <div className="space-y-4">
                    <Panel title="Entry">
                      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                        <Row label="Simplified" value={detail.entry.simplified} glyph />
                        <Row label="Traditional" value={detail.entry.traditional} glyph />
                        <Row label="Pinyin" value={detail.pinyin} />
                        <Row label="Toneless" value={detail.pinyinPlain} mono />
                        <Row
                          label="Frequency rank"
                          value={detail.frequency?.rank ? `#${detail.frequency.rank}` : "not ranked"}
                          mono
                        />
                        <Row
                          label="Occurrences"
                          value={
                            detail.frequency?.count ? detail.frequency.count.toLocaleString() : "—"
                          }
                          mono
                        />
                        <Row label="Characters" value={String(detail.length)} mono />
                        <Row label="CEDICT id" value={`#${detail.entry.id}`} mono />
                      </dl>
                    </Panel>

                    {detail.variants.length > 0 ? (
                      <Panel title="Other readings">
                        <ul className="space-y-2">
                          {detail.variants.map((variant) => (
                            <li key={variant.entry.id} className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => onSelectEntry(variant.entry.id)}
                                className="focus-halo rounded-lg px-1 text-[13px] font-medium text-primary hover:bg-primary/10"
                              >
                                {variant.pinyin}
                              </button>
                              <span className="text-[12.5px] text-muted-foreground text-pretty">
                                {variant.glosses.join("; ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    ) : null}

                    {detail.traditionalVariants.length > 0 ? (
                      <Panel title="Related script forms">
                        <ul className="space-y-2">
                          {detail.traditionalVariants.map((variant, index) => (
                            <li key={`${variant.traditional}-${index}`} className="flex items-start gap-3">
                              <span className="glyph text-[17px]">{variant.traditional}</span>
                              <span className="text-[12.5px]">
                                <span className="text-primary">{variant.pinyin}</span>
                                <span className="text-muted-foreground"> — {variant.glosses.join("; ")}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    ) : null}

                    <Panel title="Data sources">
                      <ul className="space-y-1.5 text-[12px] text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Hash className="mt-0.5 size-3.5 shrink-0" />
                          Dictionary, decomposition, phonetics and frequency come from the
                          <span className="font-medium text-foreground"> hanzi</span> package (HanziJS):
                          CC-CEDICT, CJK decomposition, Jun Da &amp; Leiden frequency data.
                        </li>
                        <li className="flex items-start gap-2">
                          <AudioLines className="mt-0.5 size-3.5 shrink-0" />
                          Stroke outlines come from hanzi-writer&apos;s data set, mirrored locally on
                          first run.
                        </li>
                      </ul>
                    </Panel>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  glyph,
}: {
  label: string;
  value: string;
  mono?: boolean;
  glyph?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-hairline pb-1.5 last:border-0">
      <dt className="w-28 shrink-0 text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-[13px]", mono && "tabular", glyph && "glyph text-[16px]")}>{value}</dd>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-10 text-center">
      <div className="glyph text-[64px] leading-none text-foreground/12">词典</div>
      <h2 className="text-[15px] font-semibold">Pick an entry</h2>
      <p className="max-w-sm text-[12.5px] leading-relaxed text-muted-foreground text-pretty">
        Choose a result to see its definitions, character decomposition, phonetic clues and
        animated stroke order.
      </p>
    </div>
  );
}
