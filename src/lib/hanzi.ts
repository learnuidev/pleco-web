/**
 * HanziJS bridge.
 *
 * HanziJS compiles ~15 MB of data files (CC-CEDICT, CJK decomposition, Jun Da
 * frequencies, Leiden corpus) the first time `start()` runs, and pulls the whole
 * thing into Node's module cache. That is a server-only cost, so this module is
 * imported exclusively from route handlers and server components.
 *
 * It is kept external to the bundle (`serverExternalPackages` in next.config.ts)
 * and required lazily through `createRequire`, both so the bundler never tries
 * to statically analyse those giant data modules and so the compile step only
 * happens when someone actually uses a feature.
 */

import { createRequire } from "node:module";

export type DecompositionLevel = 1 | 2 | 3 | 4;

export type DecompositionResult = {
  character: string;
  components?: string[];
  components1?: string[];
  components2?: string[];
  components3?: string[];
  components4?: string[];
};

export type DecompositionNode = {
  character: string;
  id?: string | number;
  children: DecompositionNode[];
};

export type PhoneticRegularity = Record<
  string,
  {
    character: string;
    component: string[];
    phoneticpinyin: string[];
    regularity: number[];
  }
>;

export type FrequencyInfo = {
  number: string;
  character: string;
  count: string;
  percentage: string;
  pinyin: string;
  meaning: string;
};

type HanziModule = {
  start: () => void;
  decompose: (character: string, level?: DecompositionLevel) => DecompositionResult;
  decomposeMany: (characters: string, level?: DecompositionLevel) => Record<string, DecompositionResult>;
  getDecompositionTree: (character: string, type?: "primitive" | "graphical") => DecompositionNode | null;
  ifComponentExists: (component: string) => boolean;
  isPrimitive: (component: string) => boolean;
  definitionLookup: (word: string, script?: "s" | "t") => Array<Record<string, string>> | null;
  dictionarySearch: (characters: string, type?: "only" | null) => Array<Array<Record<string, string>>>;
  getExamples: (character: string) => Array<Array<Record<string, string>>>;
  getPinyin: (character: string) => string[];
  segment: (phrase: string) => string[];
  getCharacterFrequency: (character: string) => FrequencyInfo | null;
  determinePhoneticRegularity: (input: string | DecompositionResult) => PhoneticRegularity | null;
  getRadicalMeaning: (radical: string) => string;
  getCharactersWithComponent: (component: string) => string | string[];
  getPhoneticSet: (character: string) => unknown;
  getCharacterInFrequencyListByPosition: (position: number) => FrequencyInfo | null;
};

const require = createRequire(import.meta.url);

const globalForHanzi = globalThis as unknown as {
  __plecoHanzi?: HanziModule;
};

/** HanziJS prints compilation progress to stdout; keep the server log clean. */
function compile(hanzi: HanziModule) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    hanzi.start();
  } finally {
    console.log = originalLog;
  }
}

export function getHanzi(): HanziModule {
  if (globalForHanzi.__plecoHanzi) return globalForHanzi.__plecoHanzi;
  const hanzi = require("hanzi") as HanziModule;
  compile(hanzi);
  globalForHanzi.__plecoHanzi = hanzi;
  return hanzi;
}

/**
 * Memoised helper for the expensive HanziJS calls.
 *
 * `has()`-guard name: values are only computed on a miss, so a hot entry costs
 * one lookup. The cache lives on `globalThis` because route handlers are
 * separate module graphs in dev.
 */
const globalForMemo = globalThis as unknown as {
  __plecoHanziMemo?: Map<string, unknown>;
};

function memo(): Map<string, unknown> {
  if (!globalForMemo.__plecoHanziMemo) globalForMemo.__plecoHanziMemo = new Map();
  return globalForMemo.__plecoHanziMemo;
}

export function memoised<T>(key: string, compute: () => T): T {
  const store = memo();
  if (store.has(key)) return store.get(key) as T;
  const value = compute();
  // Bound the cache so long-running dev sessions do not grow without limit.
  if (store.size > 4000) store.clear();
  store.set(key, value);
  return value;
}

/** `爱` → `{ components1: [...], components2: [...], components3: [...], components4: [...] }` */
export function decompose(character: string): DecompositionResult | null {
  const characters = Array.from(character);
  if (characters.length !== 1) return null;
  return memoised(`decompose:${character}`, () => {
    try {
      return getHanzi().decompose(character);
    } catch {
      return null;
    }
  });
}

export function decompositionTree(
  character: string,
  type: "primitive" | "graphical" = "primitive",
): DecompositionNode | null {
  return memoised(`tree:${type}:${character}`, () => {
    try {
      return getHanzi().getDecompositionTree(character, type) ?? null;
    } catch {
      return null;
    }
  });
}

export function componentsOf(character: string, level: DecompositionLevel = 4): string[] {
  const result = decompose(character);
  if (!result) return [];
  const key = `components${level}` as const;
  return result[key] ?? result.components ?? [];
}

export function radicalMeaning(glyph: string): string {
  try {
    return getHanzi().getRadicalMeaning(glyph) ?? "";
  } catch {
    return "";
  }
}

export function componentCharacters(component: string): string[] {
  // HanziJS answers "<component> not found" (a *string*) when it has no reverse
  // index entry, so the result has to be type-checked — treating that string as
  // a list crashed the character card with `examples.slice(...).map is not a
  // function`. Stale memo entries from an older build are discarded on read.
  const cacheKey = `component:${component}`;
  const store = memo();
  const cached = store.get(cacheKey);
  if (Array.isArray(cached)) return cached as string[];

  try {
    const value = getHanzi().getCharactersWithComponent(component);
    const list = Array.isArray(value) ? value.slice(0, 120) : [];
    store.set(cacheKey, list);
    return list;
  } catch {
    return [];
  }
}

export function readings(character: string): string[] {
  try {
    return getHanzi().getPinyin(character) ?? [];
  } catch {
    return [];
  }
}

export function phoneticRegularity(character: string): PhoneticRegularity | null {
  return memoised(`phonetic:${character}`, () => {
    try {
      return getHanzi().determinePhoneticRegularity(character) ?? null;
    } catch {
      return null;
    }
  });
}

export function phoneticSet(character: string): unknown {
  try {
    return getHanzi().getPhoneticSet(character);
  } catch {
    return null;
  }
}

export function isPrimitive(component: string): boolean {
  try {
    return Boolean(getHanzi().isPrimitive(component));
  } catch {
    return false;
  }
}

export function componentExists(component: string): boolean {
  try {
    return Boolean(getHanzi().ifComponentExists(component));
  } catch {
    return false;
  }
}

export type ExampleTier = {
  tier: "common" | "uncommon" | "rare";
  entries: Array<{ traditional: string; simplified: string; pinyin: string; definition: string }>;
};

const TIER_LABELS: ExampleTier["tier"][] = ["common", "uncommon", "rare"];

/** HanziJS ranks examples into [high, medium, low] frequency buckets. */
export function examplesFor(word: string): ExampleTier[] {
  // `getExamples` runs a full CEDICT scan per call, so it is memoised across
  // requests; the map lives on globalThis to survive module reloads.
  return memoised(`examples:${word}`, () => computeExamples(word));
}

function computeExamples(word: string): ExampleTier[] {
  try {
    const buckets = getHanzi().getExamples(word) ?? [];
    return buckets
      .map((entries, index) => ({
        tier: TIER_LABELS[index] ?? "rare",
        entries: entries as ExampleTier["entries"],
      }))
      .filter((bucket) => bucket.entries.length > 0);
  } catch {
    return [];
  }
}

export function frequencyOf(character: string, fallbackRank: number | null, definition: string) {
  try {
    const info = getHanzi().getCharacterFrequency(character);
    if (info) return info;
  } catch {
    // fall through to the CEDICT/Jun Da table
  }
  if (fallbackRank === null) return null;
  return {
    number: String(fallbackRank),
    character,
    count: "",
    percentage: "",
    pinyin: "",
    meaning: definition,
  } satisfies FrequencyInfo;
}
