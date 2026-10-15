import type { DictionaryEntry } from "./cedict";

export type CharacterBucket = {
  tier: "common" | "uncommon" | "rare";
  entries: DictionaryEntry[];
};

export type StrokePreview = {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
};

export type PhoneticMatch = {
  component: string;
  /** Numbered per HanziJS: 0 none, 1 exact+tone, 2 syllable, 3 initial, 4 final. */
  regularity: number;
  componentPinyin: string;
};

export type PhoneticGroup = {
  reading: string;
  matches: PhoneticMatch[];
};

export type ComponentInfo = {
  glyph: string;
  meaning: string;
  isRadical: boolean;
  radicalNumber: number | null;
  isPrimitive: boolean;
  /** How many other dictionary characters contain this component. */
  usageCount: number | null;
  /** A few characters that use it, as clickable chips. */
  examples: string[];
};

export type CharacterInfo = {
  glyph: string;
  pinyin: string | null;
  readings: string[];
  definition: string | null;
  decomposition: {
    once: string[];
    radical: string[];
    graphical: string[];
    primitive: string[];
  };
  tree: {
    primitive: import("../hanzi").DecompositionNode | null;
    graphical: import("../hanzi").DecompositionNode | null;
  };
  components: ComponentInfo[];
  frequency: {
    rank: number | null;
    count: number | null;
    percentile: number | null;
    meaning: string | null;
  } | null;
  strokes: StrokePreview | null;
  strokeCount: number | null;
  phoneticGroups: PhoneticGroup[];
  wordsWithCharacter: DictionaryEntry[];
};

export type RelatedEntry = {
  entry: DictionaryEntry;
  pinyin: string;
  relation: "compound" | "component" | "shared-character";
};

export type EntryDetail = {
  entry: DictionaryEntry;
  pinyin: string;
  pinyinPlain: string;
  glosses: string[];
  /** Number of hanzi in the simplified headword. */
  length: number;
  isTraditionalDistinct: boolean;
  frequency: { rank: number | null; count: number | null } | null;
  /** Same headword, other readings (CC-CEDICT splits 的/de5, di2, di4). */
  variants: Array<{ entry: DictionaryEntry; pinyin: string; glosses: string[] }>;
  /** Traditional headword that maps to the same simplified form. */
  traditionalVariants: Array<{ traditional: string; pinyin: string; glosses: string[] }>;
  characters: CharacterInfo[];
  examples: CharacterBucket[];
  related: RelatedEntry[];
  /** Entries that merely contain the headword, useful for single characters. */
  contains: Array<{ entry: DictionaryEntry; pinyin: string }>;
};

export const COMPONENT_MEANING_FALLBACK = "No glyph available";
