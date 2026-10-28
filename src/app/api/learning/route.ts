import { NextResponse } from "next/server";

import {
  canonicalGlyph,
  componentKey,
  componentsOf,
  taughtKeys as keysFor,
} from "@/lib/dictionary/components";
import { getFrequencyTable } from "@/lib/dictionary/frequency";
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
  const taughtKeys = keysFor(learned);

  const full: UnlockCharacter[] = [];
  const partial: UnlockCharacter[] = [];
  /** character → (component key → display glyph), reused by the time machine. */
  const componentSets = new Map<string, Map<string, string>>();

  for (const character of family.keys()) {
    // Every level HanziJS decomposes at (once, radical, graphical, primitive),
    // plus any learned glyph the decomposition folds away.
    const components = componentsOf(character);
    for (const glyph of family.get(character) ?? []) {
      if (!glyph || glyph === character) continue;
      const key = componentKey(glyph);
      if (!components.has(key)) components.set(key, canonicalGlyph(key) ?? glyph);
    }

    if (components.size === 0) continue;

    const learnedComponents: string[] = [];
    const missing: string[] = [];
    for (const [key, glyph] of components) {
      if (taughtKeys.has(key)) learnedComponents.push(glyph);
      else missing.push(glyph);
    }
    if (learnedComponents.length === 0) continue;

    componentSets.set(character, components);
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

  // Time machine: replay the learned glyphs in the order they were learned and
  // report what each step unlocked or moved forward.
  if (searchParams.get("timeline") === "1") {
    const taught = new Set<string>();
    const completed = new Set<string>();
    const previousPercent = new Map<string, number>();
    const steps: Array<{
      glyph: string;
      fullNew: string[];
      progressed: Array<{ glyph: string; percent: number; delta: number }>;
      counts: { full: number; partial: number };
    }> = [];

    for (const glyph of learned) {
      taught.add(componentKey(glyph));
      const fullNew: string[] = [];
      const progressed: Array<{ glyph: string; percent: number; delta: number }> = [];

      for (const [character, components] of componentSets) {
        let learnedCount = 0;
        for (const key of components.keys()) if (taught.has(key)) learnedCount += 1;
        const percent = Math.round((learnedCount / components.size) * 100);
        const before = previousPercent.get(character) ?? 0;
        if (percent === 100 && !completed.has(character)) {
          completed.add(character);
          fullNew.push(character);
        }
        if (percent > before) progressed.push({ glyph: character, percent, delta: percent - before });
        previousPercent.set(character, percent);
      }

      progressed.sort((a, b) => b.percent - a.percent);
      let partialCount = 0;
      for (const percent of previousPercent.values()) {
        if (percent > 0 && percent < 100) partialCount += 1;
      }
      steps.push({
        glyph,
        fullNew,
        progressed: progressed.slice(0, 12),
        counts: { full: completed.size, partial: partialCount },
      });
    }

    return NextResponse.json(
      { steps, summary: { learned: learned.length, full: full.length, partial: partial.length } },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Distribution of every unlock by how much of it is learned, plus the overall
  // stats — computed before the lists are capped.
  const histogram: Record<number, number> = {};
  let percentSum = 0;
  for (const unlock of [...full, ...partial]) {
    const bucket = unlock.percent >= 100 ? 100 : Math.min(90, Math.floor(unlock.percent / 10) * 10);
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
    percentSum += unlock.percent;
  }
  const totalUnlocks = full.length + partial.length;

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
      histogram,
      averagePercent: totalUnlocks > 0 ? Math.round(percentSum / totalUnlocks) : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
