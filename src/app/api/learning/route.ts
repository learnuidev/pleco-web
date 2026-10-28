import { NextResponse } from "next/server";

import { getFrequencyTable, getRadicals } from "@/lib/dictionary/frequency";
import { decompose, radicalMeaning } from "@/lib/hanzi";
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
  /** Every building block of the character: radicals and primitives. */
  components: string[];
  /** Which of those have been learned. */
  learnedComponents: string[];
  /** The components still missing before it is fully unlocked. */
  missing: string[];
  /** 0..100, over all of the character's components. */
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
  // family — 丶 covers the 41 characters that use any dot radical (丶 冫 ⺀) —
  // and each candidate remembers which learned glyphs put it there, because the
  // reverse index can know about a stroke the primitive decomposition folds into
  // a blob (丶 never shows up in 之's component list, but 之 is built on it).
  const family = new Map<string, Set<string>>();
  for (const glyph of learned) {
    for (const character of componentCharacters(glyph)) {
      if (character === glyph) continue;
      const uses = family.get(character) ?? new Set<string>();
      uses.add(glyph);
      family.set(character, uses);
      if (family.size >= MAX_CANDIDATES) break;
    }
    if (family.size >= MAX_CANDIDATES) break;
  }

  /** What a component counts as learned-by: its radical meaning, else its glyph. */
  const taughtKeys = new Set(learned.map(componentKey));

  const full: UnlockCharacter[] = [];
  const partial: UnlockCharacter[] = [];

  for (const character of family.keys()) {
    const decomposition = decompose(character);
    // Every level HanziJS decomposes at — once, radical, graphical, primitive —
    // merged into one component set: the radical pass gives the meaningful
    // radicals (未 = 木 + 一, 为 = 力 + ⺀), the graphical pass surfaces pieces it
    // folds together, and the once/primitive passes add the first split and the
    // final building blocks. Bare stroke symbols are skipped and same-meaning
    // radical forms (丶 / ⺀) collapse into one component.
    const components = new Map<string, string>();
    const add = (glyph: string | undefined) => {
      if (!glyph || glyph === "No glyph available" || glyph === character) return;
      if (!isLearnable(glyph)) return;
      const key = componentKey(glyph);
      if (!components.has(key)) components.set(key, canonicalGlyph(key) ?? glyph);
    };
    for (const level of [
      decomposition?.components1, // once
      decomposition?.components2, // radical
      decomposition?.components3, // graphical
      decomposition?.components4, // primitive
    ]) {
      for (const glyph of level ?? []) add(glyph);
    }
    // Reverse-index knowledge: a learned glyph the decomposition folds away.
    for (const glyph of family.get(character) ?? []) add(glyph);

    if (components.size === 0) continue;

    const learnedComponents: string[] = [];
    const missing: string[] = [];
    for (const [key, glyph] of components) {
      if (taughtKeys.has(key)) learnedComponents.push(glyph);
      else missing.push(glyph);
    }
    if (learnedComponents.length === 0) continue;

    const unlock: UnlockCharacter = {
      ...summary(character),
      components: [...components.values()],
      learnedComponents,
      missing,
      percent: Math.round((learnedComponents.length / components.size) * 100),
    };

    if (missing.length === 0) full.push(unlock);
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

/** CJK stroke symbols (㇇ ㇏ ㇒ …) are not learnable components. */
function isLearnable(glyph: string): boolean {
  const cp = glyph.codePointAt(0) ?? 0;
  return cp < 0x31c0 || cp > 0x31ef;
}

/**
 * Components are compared by meaning for radicals, so learning 丶 covers ⺀ and
 * one form of a radical covers its other forms; anything else compares by glyph.
 */
function componentKey(glyph: string): string {
  const meaning = radicalMeaning(glyph);
  return meaning && meaning !== "N/A" ? `radical:${meaning.toLowerCase()}` : glyph;
}

/** The canonical glyph for a component key, so ⺀ shows and links as 丶. */
let canonicalByKey: Map<string, string> | null = null;

function canonicalGlyph(key: string): string | null {
  if (!canonicalByKey) {
    canonicalByKey = new Map();
    for (const radical of getRadicals()) {
      const glyphs = [radical.glyph, ...radical.variants.map((variant) => variant.glyph)];
      for (const glyph of glyphs) {
        const componentKeyValue = componentKey(glyph);
        if (!canonicalByKey.has(componentKeyValue)) canonicalByKey.set(componentKeyValue, radical.glyph);
      }
    }
  }
  return canonicalByKey.get(key) ?? null;
}
