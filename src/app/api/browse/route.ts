import { NextResponse } from "next/server";

import { getFrequencyTable, getRadicals } from "@/lib/dictionary/frequency";
import { componentCharacters } from "@/lib/hanzi";
import strokeCounts from "@/lib/dictionary/stroke-counts.generated.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const countByStrokes = strokeCounts as Record<string, number>;
const MAX_CHARACTERS = 300;

export type BrowseItem = {
  character: string;
  pinyin: string;
  meaning: string;
  rank: number | null;
  strokes: number | null;
};

export type CharacterSort = "common" | "rare";

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
    const value = searchParams.get("value") ?? "";
    return NextResponse.json(
      { items: componentCharacters(value).map(toBrowseItem), value },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Characters.
  const stroke = parseStroke(searchParams.get("stroke"));
  const sort: CharacterSort = searchParams.get("sort") === "rare" ? "rare" : "common";

  // Without a stroke filter the pool is the whole ranked corpus; with one it is
  // the characters we actually have stroke data for.
  const characters =
    stroke === null
      ? [...getFrequencyTable().keys()]
      : Object.entries(countByStrokes)
          .filter(([, count]) => count === stroke)
          .map(([character]) => character);

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
