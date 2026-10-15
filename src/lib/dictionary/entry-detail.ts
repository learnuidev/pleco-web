/**
 * Builds the full "entry detail" payload the reader pane renders: dictionary
 * data from CC-CEDICT, linguistics from HanziJS (decomposition, components,
 * phonetic regularity, examples) and stroke outlines from the hanzi-writer data
 * set, all joined on the headword.
 */

import { getDictionary, glosses, type DictionaryEntry } from "./cedict";
import { getFrequencyTable } from "./frequency";
import { getDocById, getSearchIndex } from "./search";
import type { CharacterBucket, EntryDetail, RelatedEntry } from "./types";
import { buildCharacterInfo } from "./character";
import { examplesFor } from "../hanzi";
import { pinyinToMarks, pinyinToPlain } from "../pinyin";

const REGULARITY_LABEL: Record<number, string> = {
  1: "exact match (same tone)",
  2: "same syllable, different tone",
  3: "shares the initial",
  4: "shares the final",
};

export function regularityLabel(value: number): string {
  return REGULARITY_LABEL[value] ?? "no phonetic relationship";
}

function entryFor(id: number) {
  return getDocById(id);
}

function syntheticEntry(word: string): DictionaryEntry | null {
  const { entries } = getDictionary();
  const exact = entries.find((e) => e.simplified === word || e.traditional === word);
  if (exact) return exact;
  return null;
}

function buildExamples(word: string): CharacterBucket[] {
  const buckets = examplesFor(word);
  const seen = new Set<number>();

  return buckets.map((bucket) => {
    const entries: DictionaryEntry[] = [];
    for (const raw of bucket.entries) {
      const ids = getSearchIndex().byWord.get(raw.simplified) ?? [];
      let entry: DictionaryEntry | undefined;
      for (const id of ids) {
        const doc = getDocById(id);
        if (doc && doc.entry.traditional === raw.traditional && doc.entry.pinyin === raw.pinyin) {
          entry = doc.entry;
          break;
        }
      }
      if (!entry) entry = syntheticEntry(raw.simplified) ?? undefined;
      if (!entry) {
        entry = {
          id: -1,
          traditional: raw.traditional,
          simplified: raw.simplified,
          pinyin: raw.pinyin,
          definition: raw.definition,
        };
      }
      if (entry.id >= 0) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
      }
      entries.push(entry);
      if (entries.length >= 30) break;
    }
    return { tier: bucket.tier, entries };
  });
}

function buildRelated(entry: DictionaryEntry): RelatedEntry[] {
  const related: RelatedEntry[] = [];
  const seen = new Set<number>([entry.id]);
  const characters = Array.from(entry.simplified);

  const push = (candidate: DictionaryEntry, relation: RelatedEntry["relation"]) => {
    if (seen.has(candidate.id)) return;
    seen.add(candidate.id);
    related.push({
      entry: candidate,
      pinyin: pinyinToMarks(candidate.pinyin),
      relation,
    });
  };

  if (characters.length > 1) {
    // Other words built from the same characters (compounds sharing a morpheme).
    const counts = new Map<number, number>();
    for (const character of characters) {
      for (const id of getSearchIndex().charIndex.get(character) ?? []) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    const ranked = [...counts.entries()]
      .filter(([id]) => !seen.has(id))
      .map(([id, count]) => ({ doc: entryFor(id), count }))
      .filter((item) => item.doc !== null)
      .sort(
        (a, b) =>
          b.count - a.count ||
          Math.min(a.doc!.rank, 99_999) - Math.min(b.doc!.rank, 99_999) ||
          a.doc!.length - b.doc!.length,
      );
    for (const item of ranked) {
      if (related.length >= 18) break;
      if (item.doc) push(item.doc.entry, "shared-character");
    }
  } else {
    // Single character: words that start with it are the most useful neighbours.
    const prefix: Array<{ doc: ReturnType<typeof entryFor>; length: number }> = [];
    for (const [word, ids] of getSearchIndex().byWord) {
      if (word === entry.simplified || word.length < 2 || !word.startsWith(entry.simplified)) continue;
      for (const id of ids) prefix.push({ doc: entryFor(id), length: word.length });
      if (prefix.length > 400) break;
    }
    const sorted = prefix
      .filter((item): item is { doc: NonNullable<ReturnType<typeof entryFor>>; length: number } =>
        item.doc !== null,
      )
      .sort(
        (a, b) =>
          a.length - b.length ||
          Math.min(a.doc.rank, 99_999) - Math.min(b.doc.rank, 99_999),
      );
    for (const item of sorted) {
      if (related.length >= 18) break;
      push(item.doc.entry, "compound");
    }
  }

  return related;
}

function buildContains(entry: DictionaryEntry): Array<{ entry: DictionaryEntry; pinyin: string }> {
  if (Array.from(entry.simplified).length !== 1) return [];
  const out: Array<{ entry: DictionaryEntry; pinyin: string }> = [];
  const seen = new Set<number>([entry.id]);
  const ids = [...(getSearchIndex().charIndex.get(entry.simplified) ?? [])]
    .map((id) => entryFor(id))
    .filter((doc): doc is NonNullable<typeof doc> => doc !== null && doc.length > 1)
    .sort((a, b) => Math.min(a.rank, 99_999) - Math.min(b.rank, 99_999));
  for (const doc of ids) {
    if (seen.has(doc.entry.id)) continue;
    seen.add(doc.entry.id);
    out.push({ entry: doc.entry, pinyin: doc.pinyinMarks });
    if (out.length >= 40) break;
  }
  return out;
}

/**
 * Entry details are expensive to assemble (component lookups, phonetic analysis,
 * corpus-ranked examples) and completely deterministic for a given CEDICT
 * snapshot, so results are memoised. The map hangs off `globalThis` because each
 * route handler is its own module graph.
 */
const globalForDetailCache = globalThis as unknown as {
  __plecoEntryDetailCache?: Map<number, EntryDetail>;
};

function detailCache(): Map<number, EntryDetail> {
  if (!globalForDetailCache.__plecoEntryDetailCache) {
    globalForDetailCache.__plecoEntryDetailCache = new Map();
  }
  return globalForDetailCache.__plecoEntryDetailCache;
}

export function buildEntryDetail(id: number): EntryDetail | null {
  const cache = detailCache();
  const cached = cache.get(id);
  if (cached) return cached;

  const detail = computeEntryDetail(id);
  if (detail) {
    if (cache.size > 300) cache.clear();
    cache.set(id, detail);
  }
  return detail;
}

function computeEntryDetail(id: number): EntryDetail | null {
  const doc = getDocById(id);
  if (!doc) return null;

  const entry = doc.entry;
  const frequencyTable = getFrequencyTable();
  const freq =
    frequencyTable.get(entry.simplified) ?? frequencyTable.get(entry.traditional) ?? null;

  // Other CC-CEDICT lines for the same simplified headword (multiple readings).
  const variantIds = (getSearchIndex().byWord.get(entry.simplified) ?? []).filter((v) => v !== id);
  const variants = variantIds
    .map((v) => getDocById(v))
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .map((d) => ({
      entry: d.entry,
      pinyin: d.pinyinMarks,
      glosses: glosses(d.entry.definition),
    }));

  const traditionalIds = (getSearchIndex().byWord.get(entry.traditional) ?? []).filter(
    (v) => v !== id && getDocById(v)?.entry.simplified !== entry.simplified,
  );
  const traditionalVariants = traditionalIds
    .map((v) => getDocById(v))
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .map((d) => ({
      traditional: d.entry.traditional,
      pinyin: d.pinyinMarks,
      glosses: glosses(d.entry.definition),
    }));

  const characters = Array.from(entry.simplified)
    .slice(0, 6)
    .map((glyph) => buildCharacterInfo(glyph));

  return {
    entry,
    pinyin: doc.pinyinMarks,
    pinyinPlain: pinyinToPlain(entry.pinyin),
    glosses: glosses(entry.definition),
    length: doc.length,
    isTraditionalDistinct: entry.traditional !== entry.simplified,
    frequency: freq ? { rank: freq.rank, count: freq.count } : null,
    variants,
    traditionalVariants,
    characters,
    examples: buildExamples(entry.simplified),
    related: buildRelated(entry),
    contains: buildContains(entry),
  };
}
