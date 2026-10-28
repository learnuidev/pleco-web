import { NextResponse } from "next/server";

import { getFrequencyTable, getRadicals } from "@/lib/dictionary/frequency";
import { componentCharacters } from "@/lib/hanzi";
import { componentKey, coverageOf, taughtKeys } from "@/lib/dictionary/components";
import strokeCounts from "@/lib/dictionary/stroke-counts.generated.json";
import primitiveData from "@/lib/dictionary/primitives.generated.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const countByStrokes = strokeCounts as Record<string, number>;
const MAX_CHARACTERS = 300;
/** How many common characters the "recommended" sort scores. */
const RECOMMENDED_POOL = 1500;

export type BrowseItem = {
  character: string;
  pinyin: string;
  meaning: string;
  rank: number | null;
  strokes: number | null;
  /** Learned coverage of the character's components, for the recommended sort. */
  coverage?: number | null;
  /** Unlearned components left, the tie-breaker for recommended. */
  missing?: number | null;
};

export type CharacterSort = "common" | "rare" | "recommended";

export type PrimitiveForm = {
  key: string;
  glyph: string;
  meaning: string;
  pinyin: string;
  strokes: number | null;
  characterCount: number;
  learned: boolean;
};

export type RadicalForm = {
  key: string;
  number: number;
  glyph: string;
  meaning: string;
  pinyin: string;
  strokes: number | null;
  /** The canonical glyph of the radical; variants are `false`. */
  isPrimary: boolean;
  characterCount: number | null;
  examples: string[];
  learned: boolean;
};

/**
 * Powers the Browse tab.
 *
 *  - `mode=characters` — the frequency-ranked characters, optionally narrowed to
 *    one stroke count and ordered most-common-first or least-common-first.
 *  - `mode=radicals`   — the Kangxi radical inventory.
 *  - `mode=component`  — characters that use a component.
 *
 * Frequency comes from the Jun Da table, stroke counts from the locally mirrored
 * hanzi-writer data.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "characters";

  if (mode === "radicals") {
    // Each form is its own browsable entry: the canonical glyph and every
    // variant carry their own stroke count and usage, so the stroke filters and
    // the distribution chart can count them independently.
    const forms: RadicalForm[] = [];
    const learned = parseLearned(searchParams.get("learned"));
    const taught = taughtKeys(learned);
    for (const radical of getRadicals()) {
      forms.push({
        key: `radical:${radical.number}`,
        number: radical.number,
        glyph: radical.glyph,
        meaning: radical.meaning,
        pinyin: radical.pinyin,
        strokes: radical.strokes,
        isPrimary: true,
        characterCount: characterCountFor(radical.glyph),
        examples: radical.examples,
        learned: taught.has(componentKey(radical.glyph)),
      });
      radical.variants.forEach((variant, index) => {
        forms.push({
          key: `radical:${radical.number}:v${index}`,
          number: radical.number,
          glyph: variant.glyph,
          meaning: radical.meaning,
          pinyin: radical.pinyin,
          strokes: variant.strokes,
          isPrimary: false,
          characterCount: characterCountFor(variant.glyph),
          examples: radical.examples,
          learned: taught.has(componentKey(variant.glyph)),
        });
      });
    }
    if (searchParams.get("sort") === "recommended") {
      // Recommended: learn the unlearned radicals that unlock the most characters.
      forms.sort(
        (a, b) =>
          Number(a.learned) - Number(b.learned) ||
          (b.characterCount ?? 0) - (a.characterCount ?? 0) ||
          (a.strokes ?? 99) - (b.strokes ?? 99),
      );
    }
    return NextResponse.json({ forms }, { headers: { "Cache-Control": "no-store" } });
  }

  if (mode === "primitives") {
    const learned = parseLearned(searchParams.get("learned"));
    const taught = taughtKeys(learned);
    const primitives: PrimitiveForm[] = (primitiveData as Array<{
      glyph: string;
      pinyin: string;
      meaning: string;
      strokes: number | null;
      characterCount: number;
    }>)
      .map((primitive) => ({
        key: `primitive:${primitive.glyph}`,
        glyph: primitive.glyph,
        meaning: primitive.meaning,
        pinyin: primitive.pinyin,
        strokes: primitive.strokes,
        characterCount: primitive.characterCount,
        learned: taught.has(componentKey(primitive.glyph)),
      }))
      // Recommended: learn the unlearned primitive that unlocks the most
      // characters first.
      .sort((a, b) =>
        searchParams.get("sort") === "recommended"
          ? Number(a.learned) - Number(b.learned) ||
            b.characterCount - a.characterCount ||
            (a.strokes ?? 99) - (b.strokes ?? 99)
          : 0,
      );
    return NextResponse.json({ primitives }, { headers: { "Cache-Control": "no-store" } });
  }

  if (mode === "component") {
    const value = searchParams.get("value") ?? "";
    return NextResponse.json(
      { items: componentCharacters(value).map(toBrowseItem), value },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Characters.
  const stroke = parseStroke(searchParams.get("stroke"));
  const sortParam = searchParams.get("sort");
  const sort: CharacterSort =
    sortParam === "rare" ? "rare" : sortParam === "recommended" ? "recommended" : "common";
  const learned = parseLearned(searchParams.get("learned"));
  const taught = taughtKeys(learned);

  // Without a stroke filter the pool is the whole ranked corpus; with one it is
  // the characters we actually have stroke data for.
  const characters =
    stroke === null
      ? [...getFrequencyTable().keys()]
      : Object.entries(countByStrokes)
          .filter(([, count]) => count === stroke)
          .map(([character]) => character);

  if (sort === "recommended") {
    // "What should I learn next": characters you are closest to finishing come
    // first; ties go to the one with fewer unlearned components, then the more
    // common character. Only the common part of the corpus is scored, which both
    // keeps the request fast and biases recommendations toward characters worth
    // learning.
    const ranked = [...getFrequencyTable().values()]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, RECOMMENDED_POOL)
      .map((record) => toBrowseItem(record.character))
      .map((item) => {
        const coverage = coverageOf(item.character, taught);
        return { ...item, coverage: coverage.percent, missing: coverage.missing };
      })
      .filter((item) => item.rank !== null);
    const items = ranked
      .sort(
        (a, b) =>
          b.coverage - a.coverage || a.missing - b.missing || rankDelta(a.rank, b.rank),
      )
      .slice(0, MAX_CHARACTERS);
    return NextResponse.json(
      { items, total: ranked.length, stroke, sort, strokeHistogram: histogram() },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const items = characters
    .map(toBrowseItem)
    .sort((a, b) => rankDelta(a.rank, b.rank) * (sort === "rare" ? -1 : 1));

  return NextResponse.json(
    {
      items: items.slice(0, MAX_CHARACTERS),
      total: items.length,
      stroke,
      sort,
      strokeHistogram: histogram(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** The learned glyphs arrive as a comma-separated list. */
function parseLearned(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((glyph) => glyph.trim())
    .filter((glyph) => glyph.length > 0 && glyph.length <= 4)
    .slice(0, 500);
}

function parseStroke(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 64 ? value : null;
}

/** Unranked characters sort as the rarest. */
function rankDelta(a: number | null, b: number | null): number {
  return (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER);
}

function toBrowseItem(character: string): BrowseItem {
  const frequency = getFrequencyTable().get(character);
  return {
    character,
    pinyin: frequency?.pinyin.split("/")[0] ?? "",
    meaning: frequency?.meaning ?? "",
    rank: frequency?.rank ?? null,
    strokes: countByStrokes[character] ?? null,
  };
}

function characterCountFor(component: string): number | null {
  try {
    return componentCharacters(component).length;
  } catch {
    return null;
  }
}

/** Characters per stroke count, over the mirrored stroke data. */
function histogram(): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const strokes of Object.values(countByStrokes)) {
    counts[strokes] = (counts[strokes] ?? 0) + 1;
  }
  return counts;
}

/** Exposed for the client-side "is this character in the offline set" hint. */
export function localStrokeCharacters(): string[] {
  return Object.keys(countByStrokes);
}
