import { NextResponse } from "next/server";

import { buildCharacterInfo } from "@/lib/dictionary/character";
import { getFrequencyTable, findRadicalMatch } from "@/lib/dictionary/frequency";
import { componentCharacters } from "@/lib/hanzi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEARNED = 500;
const MAX_CANDIDATES = 600;
const MAX_PER_SECTION = 120;

type CharacterSummary = {
  glyph: string;
  pinyin: string;
  meaning: string;
  rank: number | null;
};

type UnlockCharacter = CharacterSummary & {
  /** The radicals this character is built from. */
  radicals: string[];
  /** Which of those have been learned. */
  learnedRadicals: string[];
  /** The radicals still missing before it is fully unlocked. */
  missing: string[];
  /** 0..100 */
  percent: number;
};

/**
 * `GET /api/learning?learned=木,水,心`
 *
 * Everything the Learning page needs, computed from the browser's learned set:
 * the learned characters themselves, the characters whose radicals are all
 * learned (full unlocks) and the ones only partly covered (partial unlocks,
 * with the percentage and the remaining radicals).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("learned") ?? "";
  const learned = Array.from(
    new Set(
      raw
        .split(",")
        .map((glyph) => glyph.trim())
        .filter((glyph) => glyph.length > 0 && glyph.length <= 4),
    ),
  ).slice(0, MAX_LEARNED);

  const frequency = getFrequencyTable();
  const summary = (glyph: string): CharacterSummary => {
    const record = frequency.get(glyph);
    return {
      glyph,
      pinyin: record?.pinyin.split("/")[0] ?? "",
      meaning: record?.meaning ?? "",
      rank: record?.rank ?? null,
    };
  };

  const learnedSet = new Set(learned);

  // Characters built on the learned glyphs. A learned radical reaches its whole
  // family; a learned word contributes nothing here.
  const candidates = new Set<string>();
  for (const glyph of learned) {
    for (const character of componentCharacters(glyph)) {
      if (character === glyph) continue;
      candidates.add(character);
      if (candidates.size >= MAX_CANDIDATES) break;
    }
    if (candidates.size >= MAX_CANDIDATES) break;
  }

  const full: UnlockCharacter[] = [];
  const partial: UnlockCharacter[] = [];

  for (const character of candidates) {
    const info = buildCharacterInfo(character);
    const radicals = Array.from(
      new Set(
        info.components
          .filter((component) => component.isRadical)
          .map((component) => component.glyph)
          .concat(
            // A character that is itself a radical is built on that radical.
            findRadicalMatch([character]) ? [character] : [],
          ),
      ),
    );
    if (radicals.length === 0) continue;

    const learnedRadicals = radicals.filter((radical) => learnedSet.has(radical));
    if (learnedRadicals.length === 0) continue;

    const unlock: UnlockCharacter = {
      ...summary(character),
      radicals,
      learnedRadicals,
      missing: radicals.filter((radical) => !learnedSet.has(radical)),
      percent: Math.round((learnedRadicals.length / radicals.length) * 100),
    };

    if (learnedRadicals.length === radicals.length) full.push(unlock);
    else partial.push(unlock);
  }

  const byRank = (a: UnlockCharacter, b: UnlockCharacter) =>
    (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER);

  full.sort(byRank);
  partial.sort((a, b) => b.percent - a.percent || byRank(a, b));

  return NextResponse.json(
    {
      learned: learned.map(summary),
      full: full.slice(0, MAX_PER_SECTION),
      partial: partial.slice(0, MAX_PER_SECTION),
      counts: {
        learned: learned.length,
        full: full.length,
        partial: partial.length,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
