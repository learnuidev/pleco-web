import { NextResponse } from "next/server";

import { getFrequencyTable, getRadicals } from "@/lib/dictionary/frequency";
import { componentCharacters } from "@/lib/hanzi";
import strokeCounts from "@/lib/dictionary/stroke-counts.generated.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const countByStrokes = strokeCounts as Record<string, number>;

export type BrowseItem = {
  character: string;
  pinyin: string;
  meaning: string;
  rank: number | null;
  strokes: number | null;
};

/**
 * Powers the Browse tab: most frequent characters, characters that use a given
 * component, and characters filtered by stroke count. Frequency comes from the
 * Jun Da table, stroke counts from the locally mirrored hanzi-writer data.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "frequency";
  const value = searchParams.get("value") ?? "";

  if (mode === "radicals") {
    return NextResponse.json(
      {
        radicals: getRadicals().map((radical) => ({
          ...radical,
          characterCount: characterCountFor(radical.glyph),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (mode === "component") {
    const characters = componentCharacters(value).map(toBrowseItem);
    return NextResponse.json(
      { items: characters, value },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (mode === "strokes") {
    const target = Number(value);
    const items = Object.entries(countByStrokes)
      .filter(([, strokes]) => strokes === target)
      .map(([character]) => toBrowseItem(character))
      .sort((a, b) => (a.rank ?? 99_999) - (b.rank ?? 99_999));
    return NextResponse.json({ items, value, strokeHistogram: histogram() }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Default: the most frequent single characters in the corpus.
  const frequency = getFrequencyTable();
  const items: BrowseItem[] = [];
  for (const record of frequency.values()) {
    if (items.length >= 300) break;
    items.push({
      character: record.character,
      pinyin: record.pinyin.split("/")[0] ?? "",
      meaning: record.meaning,
      rank: record.rank,
      strokes: countByStrokes[record.character] ?? null,
    });
  }

  return NextResponse.json(
    { items, axes: { radicals: getRadicals().length, strokeHistogram: histogram() } },
    { headers: { "Cache-Control": "no-store" } },
  );
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
