"use client";

import { Boxes, Quote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Glyph } from "@/components/glyph";
import { Panel } from "@/components/workbench/panel";
import type { CharacterInfo, EntryDetail } from "@/lib/dictionary/types";
import { characterHref } from "@/lib/routes";

const VISIBLE = 42;

/**
 * The three "list" views of the Characters tab, each its own sub-tab:
 * which characters are built on this one, the common two-character words it
 * appears in, and every headword that merely contains it.
 *
 * All of them are links into `/dictionary/:character`.
 */

/** Characters that use each character of the headword as a component. */
export function CharactersUsingPanel({ characters }: { characters: CharacterInfo[] }) {
  const usable = characters.filter((info) => (info.usedIn?.total ?? 0) > 0);

  return (
    <div className="space-y-3">
      {usable.map((info) => (
        <Panel
          key={info.glyph}
          title={`Characters using ${info.glyph}`}
          action={
            <span className="tabular rounded-full bg-foreground/6 px-1.5 py-px text-[10.5px] text-muted-foreground">
              {info.usedIn?.total ?? 0}
            </span>
          }
        >
          <GlyphChips glyphs={info.usedIn?.characters ?? []} />
        </Panel>
      ))}
    </div>
  );
}

/** Common two-character words this headword's characters appear in. */
export function CommonWordsPanel({ characters }: { characters: CharacterInfo[] }) {
  const router = useRouter();
  const usable = characters.filter((info) => info.wordsWithCharacter.length > 0);

  return (
    <div className="space-y-3">
      {usable.map((info) => (
        <Panel
          key={info.glyph}
          title={`Common words with ${info.glyph}`}
          action={
            <span className="tabular text-[10.5px] text-muted-foreground">
              {info.wordsWithCharacter.length}
            </span>
          }
        >
          <div className="flex flex-wrap gap-1">
            {info.wordsWithCharacter.map((word) => (
              <button
                key={word.id}
                type="button"
                onClick={() => router.push(characterHref(word.simplified))}
                className="focus-halo inline-flex items-center gap-1.5 rounded-lg bg-foreground/4 px-2 py-1 text-[12px] transition-colors hover:bg-primary/10"
              >
                <span className="glyph text-[15px] leading-none">{word.simplified}</span>
                <span className="text-muted-foreground">
                  {word.definition.split("/")[0]?.slice(0, 18)}
                </span>
              </button>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

/** Every headword that contains this one (single-character headwords only). */
export function WordsContainingPanel({
  contains,
}: {
  contains: EntryDetail["contains"];
}) {
  const router = useRouter();

  return (
    <Panel
      title="Words containing this"
      action={<span className="tabular text-[10.5px] text-muted-foreground">{contains.length}</span>}
      compact
      contentClassName="p-1.5"
    >
      <ul className="grid gap-0.5 sm:grid-cols-2">
        {contains.map((item) => (
          <li key={item.entry.id}>
            <button
              type="button"
              onClick={() => router.push(characterHref(item.entry.simplified))}
              className="focus-halo flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-primary/8"
            >
              <span className="glyph text-[17px]">{item.entry.simplified}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] text-primary">{item.pinyin}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">
                  {item.entry.definition.split("/")[0]}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** A wrapped, expandable row of character links. */
function GlyphChips({ glyphs }: { glyphs: string[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? glyphs : glyphs.slice(0, VISIBLE);
  const hidden = glyphs.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((glyph) => (
        <button
          key={glyph}
          type="button"
          onClick={() => router.push(characterHref(glyph))}
          title={`Open ${glyph}`}
          className="glyph focus-halo rounded-lg bg-foreground/4 px-1.5 py-0.5 text-[17px] leading-normal transition-colors hover:bg-primary/12 hover:text-foreground"
        >
          {glyph}
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
    </div>
  );
}

/** Panel icons, exported so the tab bar can share them. */
export const LIST_ICONS = { using: Boxes, containing: Quote } as const;
