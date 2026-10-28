"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { AudioLines, Hash, Info, Layers, Loader2, PenLine, Quote } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CharacterCard } from "@/components/entry/character-card";
import {
  CharactersUsingPanel,
  CommonWordsPanel,
  WordsContainingPanel,
} from "@/components/entry/character-lists";
import { EntryHero } from "@/components/entry/entry-hero";
import { ExampleBuckets, RelatedList } from "@/components/entry/example-buckets";
import { Panel } from "@/components/workbench/panel";
import { StrokeOrderPanel } from "@/components/stroke/stroke-order-panel";
import { useWorkbench, type SavedItem } from "@/components/workbench/state";
import {
  entryHref,
  isReaderSubTab,
  isReaderTab,
  syncEntryUrl,
  type ReaderSubTabKey,
} from "@/lib/routes";
import type { EntryDetail } from "@/lib/dictionary/types";
import { cn } from "@/lib/utils";

type TabKey = "strokes" | "characters" | "examples" | "details";

const TABS: Array<{ key: TabKey; label: string; icon: typeof PenLine }> = [
  { key: "characters", label: "Characters", icon: Layers },
  { key: "strokes", label: "Strokes", icon: PenLine },
  { key: "examples", label: "Examples", icon: Quote },
  { key: "details", label: "Details", icon: Info },
];

/** The tab a URL without `?tab=` opens. */
const DEFAULT_READER_TAB: TabKey = "characters";

/** Sub-tabs of the Characters pane; order is the display order. */
const CHARACTER_SUB_TABS: Array<{ key: ReaderSubTabKey; label: string }> = [
  { key: "breakdown", label: "Breakdown" },
  { key: "using", label: "Characters using" },
  { key: "words", label: "Common words" },
  { key: "containing", label: "Words containing" },
];

export function EntryDetailPane() {
  const { state, dispatch, headword, traditionalHint, runSearch, selectEntry } = useWorkbench();
  const entryId = state.selectedId;
  const onSearch = runSearch;
  const onSelectEntry = selectEntry;
  const [detail, setDetail] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The URL owns which tab is open: it is read here and rewritten through the
  // router, so a link reproduces exactly what is on screen.
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const subParam = searchParams.get("sub");
  const tab: TabKey = isReaderTab(tabParam) ? tabParam : DEFAULT_READER_TAB;
  const requestedSub: ReaderSubTabKey = isReaderSubTab(subParam) ? subParam : "breakdown";
  const subTab = detail ? activeSubTab(detail, requestedSub) : requestedSub;

  /** Rewrite the URL for a tab change; the re-render follows from the route. */
  const goToTab = useCallback(
    (nextTab: TabKey, nextSub: ReaderSubTabKey) => {
      const current = detail?.entry.simplified ?? state.query;
      if (!current) return;
      const href = entryHref(current, nextTab, nextSub);
      if (`${window.location.pathname}${window.location.search}` !== href) {
        // push, not replace: Back walks the tabs you visited, and the URL stays
        // the single source of truth for what is on screen.
        router.push(href, { scroll: false });
      }
    },
    [detail, state.query, router],
  );

  const setTab = (next: TabKey) => goToTab(next, subTab);
  const setSubTab = (next: ReaderSubTabKey) => goToTab("characters", next);
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

  /** Keep the URL on the entry the reader is actually showing. */
  useEffect(() => {
    if (!detail) return;
    syncEntryUrl(detail.entry.simplified, tab, subTab);
  }, [detail, tab, subTab]);

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
                  <div className="space-y-3">
                    <CharacterSubTabs
                      detail={detail}
                      active={subTab}
                      onChange={setSubTab}
                    />

                    {subTab === "breakdown" ? (
                      <div className="space-y-4">
                        {detail.characters.map((info) => (
                          <CharacterCard key={info.glyph} info={info} onSearch={onSearch} />
                        ))}
                      </div>
                    ) : null}

                    {subTab === "using" ? (
                      <CharactersUsingPanel characters={detail.characters} />
                    ) : null}

                    {subTab === "words" ? (
                      <CommonWordsPanel characters={detail.characters} />
                    ) : null}

                    {subTab === "containing" ? (
                      <WordsContainingPanel contains={detail.contains} />
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

/** Sub-tabs that actually have content for this entry. */
function availableSubTabs(detail: EntryDetail): ReaderSubTabKey[] {
  const hasUsing = detail.characters.some((info) => (info.usedIn?.total ?? 0) > 0);
  const hasWords = detail.characters.some((info) => info.wordsWithCharacter.length > 0);
  const hasContaining = detail.contains.length > 0;
  return [
    "breakdown",
    ...(hasUsing ? (["using"] as const) : []),
    ...(hasWords ? (["words"] as const) : []),
    ...(hasContaining ? (["containing"] as const) : []),
  ];
}

/** The sub-tab to show: the one in the URL when it exists, else Breakdown. */
function activeSubTab(detail: EntryDetail, requested: ReaderSubTabKey): ReaderSubTabKey {
  return availableSubTabs(detail).includes(requested) ? requested : "breakdown";
}

function CharacterSubTabs({
  detail,
  active,
  onChange,
}: {
  detail: EntryDetail;
  active: ReaderSubTabKey;
  onChange: (tab: ReaderSubTabKey) => void;
}) {
  const available = availableSubTabs(detail);
  if (available.length <= 1) return null;

  const count = (key: ReaderSubTabKey): number | null => {
    if (key === "using") {
      return detail.characters.reduce((sum, info) => sum + (info.usedIn?.total ?? 0), 0);
    }
    if (key === "words") {
      return detail.characters.reduce((sum, info) => sum + info.wordsWithCharacter.length, 0);
    }
    if (key === "containing") return detail.contains.length;
    return null;
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl bg-foreground/5 p-1">
      {CHARACTER_SUB_TABS.filter((option) => available.includes(option.key)).map((option) => {
        const isActive = option.key === active;
        const badge = count(option.key);
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              "focus-halo relative rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="character-sub-tab"
                className="absolute inset-0 rounded-lg bg-card shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {option.label}
              {badge !== null ? (
                <span className="tabular rounded-full bg-foreground/8 px-1.5 py-px text-[10px] text-muted-foreground">
                  {badge}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
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
