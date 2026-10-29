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
/**
 * Safety stop for the number of characters decomposed per request. The learned
 * set is ordered differently by every caller (the newest-first store vs the
 * time machine's oldest-first replay), so this may never be applied in list
 * order: whatever survives is chosen by frequency, never by arrival.
 */
const MAX_CANDIDATES = 4000;
const MAX_PER_SECTION = 120;
/**
 * How many partly-unlocked characters travel over the wire. The counts, the
 * histogram and the bucket filters always cover every unlock; only the grid is
 * bounded, closest-to-done first, so the page never renders thousands of cards.
 */
const MAX_PARTIAL = 600;

/**
 * Grow the taught set to a fixpoint: a character whose components are all
 * learned counts as learned itself, which can finish further characters.
 *
 * Work-queue shaped rather than repeated passes: each character is counted once
 * against the keys it still needs, and every newly taught key releases the
 * characters waiting on it. That keeps a 4 000-candidate closure linear instead
 * of quadratic, which matters because the time machine runs it per replay step.
 */
function closeTaught(taught: Set<string>, componentSets: Map<string, Map<string, string>>): void {
  /** key → characters that become finished once that key is taught. */
  const waiters = new Map<string, string[]>();
  /** character → how many of its components are still unlearned. */
  const outstanding = new Map<string, number>();
  const ready: string[] = [];

  for (const [character, components] of componentSets) {
    let count = 0;
    for (const key of components.keys()) {
      if (taught.has(key)) continue;
      count += 1;
      const waiting = waiters.get(key);
      if (waiting) waiting.push(character);
      else waiters.set(key, [character]);
    }
    if (count === 0) ready.push(character);
    else outstanding.set(character, count);
  }

  while (ready.length > 0) {
    const character = ready.pop() as string;
    const key = componentKey(character);
    if (taught.has(key)) {
      // Already known, so nobody is waiting on it any more.
      continue;
    }
    taught.add(key);
    for (const waiter of waiters.get(key) ?? []) {
      const left = outstanding.get(waiter);
      // Already released: its other keys had been taught first.
      if (left === undefined) continue;
      if (left > 1) {
        outstanding.set(waiter, left - 1);
      } else {
        outstanding.delete(waiter);
        ready.push(waiter);
      }
    }
  }
}

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
  /** Optional: restrict the returned partial list to one percentage bucket. */
  const rawBucket = searchParams.get("partialBucket");
  const partialBucket =
    rawBucket !== null && rawBucket !== "" && Number.isInteger(Number(rawBucket))
      ? Math.min(90, Math.max(0, Number(rawBucket)))
      : null;
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

  /** Jun Da rank, or "unranked" — the only tie-breaker candidate order may use. */
  const rankOf = (glyph: string) => frequency.get(glyph)?.rank ?? Number.MAX_SAFE_INTEGER;

  // Characters built on the learned glyphs. A learned radical reaches its whole
  // family — 丶 covers the 41 characters that use any dot radical (丶 冫 ⺀) —
  // and each candidate remembers which learned glyphs put it there, because the
  // reverse index can know about a stroke the primitive decomposition folds into
  // a blob (丶 never shows up in 之's component list, but 之 is built on it).
  //
  // Every learned glyph contributes before anything is narrowed. Trimming inside
  // this loop let the *order* of `learned` decide the answers — the store hands
  // glyphs over newest-first, the time machine replays them oldest-first, so the
  // same set reported wildly different unlock counts (25 fully unlocked on the
  // last replay step vs 3 with replay off). The union is order-free; only the
  // safety stop below narrows it, and that uses frequency, not arrival order.
  const family = new Map<string, Set<string>>();
  for (const glyph of learned) {
    for (const character of componentCharacters(glyph)) {
      if (character === glyph) continue;
      const uses = family.get(character) ?? new Set<string>();
      uses.add(glyph);
      family.set(character, uses);
    }
  }

  /** What a component counts as learned-by: its radical meaning, else its glyph. */
  const taught = keysFor(learned);

  const full: UnlockCharacter[] = [];
  const partial: UnlockCharacter[] = [];
  /** character → (component key → display glyph), reused by the time machine. */
  const componentSets = new Map<string, Map<string, string>>();

  // The candidate list is narrowed by frequency, then by glyph, so two orders of
  // the same learned set always decompose the same characters and return the
  // same counts.
  const candidates = [...family.keys()].sort(
    (a, b) => rankOf(a) - rankOf(b) || (a < b ? -1 : a > b ? 1 : 0),
  );

  for (const character of candidates.slice(0, MAX_CANDIDATES)) {
    // Every level the learning equation counts (once, radical, primitive), plus
    // any learned glyph the decomposition folds away.
    const components = componentsOf(character);
    for (const glyph of family.get(character) ?? []) {
      if (!glyph || glyph === character) continue;
      const key = componentKey(glyph);
      if (!components.has(key)) components.set(key, canonicalGlyph(key) ?? glyph);
    }

    if (components.size === 0) continue;

    // Characters with nothing learned yet are not unlocks; the rest are kept so
    // the closure below and the time machine can classify them.
    let started = false;
    for (const key of components.keys()) {
      if (taught.has(key)) {
        started = true;
        break;
      }
    }
    if (!started) continue;

    componentSets.set(character, components);
  }

  // A character whose components are all learned is itself unlocked, so it
  // teaches its own key: a half-finished 三 must not keep listing 二 as missing
  // once 二 is sitting in the fully-unlocked list. This is a fixpoint — an
  // unlock can finish another character, which can finish another — so it runs
  // as a work queue rather than a fixed number of passes.
  closeTaught(taught, componentSets);

  for (const [character, components] of componentSets) {
    const learnedComponents: string[] = [];
    const missing: string[] = [];
    for (const [key, glyph] of components) {
      if (taught.has(key)) learnedComponents.push(glyph);
      else missing.push(glyph);
    }

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

  // A bucket filter narrows the returned list *after* the histogram is built, so
  // the chart (which counts every unlock) and the grid always agree.
  const partialForResponse =
    partialBucket === null
      ? partial
      : partial.filter(
          (unlock) => Math.min(90, Math.floor(unlock.percent / 10) * 10) === partialBucket,
        );

  // Time machine: replay the learned glyphs in the order they were learned and
  // report what each step unlocked or moved forward.
  if (searchParams.get("timeline") === "1") {
    const taughtSoFar = new Set<string>();
    const completed = new Set<string>();
    const previousPercent = new Map<string, number>();
    const steps: Array<{
      glyph: string;
      fullNew: string[];
      progressed: Array<{ glyph: string; percent: number; delta: number }>;
      counts: { full: number; partial: number };
    }> = [];

    for (const glyph of learned) {
      taughtSoFar.add(componentKey(glyph));
      // Same rule as the snapshot: a character this step finishes teaches its
      // radical, so later steps see it as learned too.
      closeTaught(taughtSoFar, componentSets);
      const fullNew: string[] = [];
      const progressed: Array<{ glyph: string; percent: number; delta: number }> = [];

      for (const [character, components] of componentSets) {
        let learnedCount = 0;
        for (const key of components.keys()) if (taughtSoFar.has(key)) learnedCount += 1;
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
  const partialHistogram: Record<number, number> = {};
  let percentSum = 0;
  for (const unlock of [...full, ...partial]) {
    const bucket = unlock.percent >= 100 ? 100 : Math.min(90, Math.floor(unlock.percent / 10) * 10);
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
    percentSum += unlock.percent;
  }
  for (const unlock of partial) {
    const bucket = Math.min(90, Math.floor(unlock.percent / 10) * 10);
    partialHistogram[bucket] = (partialHistogram[bucket] ?? 0) + 1;
  }
  const totalUnlocks = full.length + partial.length;

  return NextResponse.json(
    {
      learned: learned.map(summary),
      full: full.slice(0, MAX_PER_SECTION),
      // Closest to done first; the counts above still describe every unlock.
      partial: partialForResponse.slice(0, MAX_PARTIAL),
      counts: {
        learned: learned.length,
        full: full.length,
        partial: partial.length,
      },
      histogram,
      partialHistogram,
      averagePercent: totalUnlocks > 0 ? Math.round(percentSum / totalUnlocks) : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
