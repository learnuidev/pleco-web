/**
 * Search index for the dictionary.
 *
 * Built once per Node process from the parsed CEDICT table:
 *  - `byWord`      exact headword lookup (simplified and traditional)
 *  - `pinyinIndex` tone-free pinyin key → docs   (`xuehua` → 雪花, 學花…)
 *  - `glossIndex`  english token      → docs   (`snow`  → 雪, 下雪…)
 *  - `charIndex`   single character   → docs   (character → words containing it)
 *
 * English tokens are indexed from the *start of each gloss segment* only, which
 * is how CEDICT is written ("snow/snowfall/to snow") and keeps the index roughly
 * a third of the size of a full word index while matching how people search.
 */

import { getDictionary, glosses, type DictionaryEntry } from "./cedict";
import { getFrequencyTable } from "./frequency";
import { isHanText, pinyinSearchKey, pinyinToMarks } from "../pinyin";

export type SearchKind = "word" | "character" | "pinyin" | "english" | "contains";

export type SearchDoc = {
  entry: DictionaryEntry;
  pinyinMarks: string;
  pinyinKey: string;
  simplifiedKey: string;
  traditionalKey: string;
  length: number;
  rank: number;
  glossTokens: string[];
};

export type SearchHit = {
  entry: DictionaryEntry;
  /** Tone-marked pinyin, ready to render. */
  pinyin: string;
  /** Toneless pinyin key, for highlighting. */
  pinyinKey: string;
  /** Jun Da frequency rank for single characters. */
  frequency: number | null;
  matchedOn: SearchKind;
  /** The query fragment that produced the hit. */
  matched: string;
  score: number;
};

export type SearchResponse = {
  query: string;
  mode: SearchMode;
  /** How the query was interpreted (segmentation for phrases). */
  segments: string[];
  hits: SearchHit[];
  total: number;
  truncated: boolean;
};

export type SearchMode = "chinese" | "pinyin" | "english" | "mixed" | "empty";

type Index = {
  docs: SearchDoc[];
  byWord: Map<string, number[]>;
  pinyinIndex: Map<string, number[]>;
  glossIndex: Map<string, number[]>;
  charIndex: Map<string, number[]>;
  singleCharacters: Set<string>;
};

let index: Index | null = null;

const PINYIN_QUERY = /^[a-zü:v\s'1-5]+$/i;

export function looksLikePinyin(query: string): boolean {
  return PINYIN_QUERY.test(query.trim()) && /[a-z]/i.test(query);
}

function buildIndex(): Index {
  const { entries } = getDictionary();
  const frequency = getFrequencyTable();

  const docs: SearchDoc[] = new Array(entries.length);
  const byWord = new Map<string, number[]>();
  const pinyinIndex = new Map<string, number[]>();
  const glossIndex = new Map<string, number[]>();
  const charIndex = new Map<string, number[]>();
  const singleCharacters = new Set<string>();

  const push = <K>(map: Map<K, number[]>, key: K, value: number) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(value);
    else map.set(key, [value]);
  };

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const pinyinKey = pinyinSearchKey(entry.pinyin);
    const freq = frequency.get(entry.simplified) ?? frequency.get(entry.traditional);
    const tokens = new Set<string>();

    for (const gloss of glosses(entry.definition)) {
      const match = /^[A-Za-z][A-Za-z'-]*/.exec(gloss);
      if (match) tokens.add(match[0].toLowerCase());
    }

    docs[i] = {
      entry,
      pinyinMarks: pinyinToMarks(entry.pinyin),
      pinyinKey,
      simplifiedKey: entry.simplified,
      traditionalKey: entry.traditional,
      length: Array.from(entry.simplified).length,
      rank: freq?.rank ?? Number.MAX_SAFE_INTEGER,
      glossTokens: [...tokens],
    };

    push(byWord, entry.simplified, i);
    if (entry.traditional !== entry.simplified) push(byWord, entry.traditional, i);

    if (pinyinKey) push(pinyinIndex, pinyinKey, i);

    for (const token of tokens) push(glossIndex, token, i);

    for (const char of Array.from(entry.simplified)) {
      push(charIndex, char, i);
      if (docs[i].length === 1) singleCharacters.add(char);
    }
  }

  return { docs, byWord, pinyinIndex, glossIndex, charIndex, singleCharacters };
}

export function getSearchIndex(): Index {
  if (!index) index = buildIndex();
  return index;
}

function scoreFor(kind: SearchKind, doc: SearchDoc, exact: boolean): number {
  const kindWeight: Record<SearchKind, number> = {
    word: 0,
    character: 1,
    pinyin: 2,
    english: 3,
    contains: 4,
  };
  // Shorter headwords first (single characters / two-character words), then the
  // corpus frequency rank as a tie-breaker, then alphabetical for determinism.
  return (
    kindWeight[kind] * 1_000_000 +
    (exact ? 0 : 100_000) +
    doc.length * 1_000 +
    Math.min(doc.rank, 99_999)
  );
}

function toHit(doc: SearchDoc, kind: SearchKind, matched: string, exact: boolean): SearchHit {
  const frequencyTable = getFrequencyTable();
  const freq = frequencyTable.get(doc.entry.simplified) ?? frequencyTable.get(doc.entry.traditional);
  return {
    entry: doc.entry,
    pinyin: doc.pinyinMarks,
    pinyinKey: doc.pinyinKey,
    frequency: Array.from(doc.entry.simplified).length === 1 ? (freq?.rank ?? null) : null,
    matchedOn: kind,
    matched,
    score: scoreFor(kind, doc, exact),
  };
}

function dedupe(hits: SearchHit[]): SearchHit[] {
  const seen = new Map<number, SearchHit>();
  for (const hit of hits) {
    const existing = seen.get(hit.entry.id);
    if (!existing || hit.score < existing.score) seen.set(hit.entry.id, hit);
  }
  return [...seen.values()];
}

function lookupExact(word: string): number[] {
  return getSearchIndex().byWord.get(word) ?? [];
}

/**
 * Longest-match segmentation over the dictionary headwords. HanziJS ships its
 * own segmenter, but it returns bare strings; we need the matched entry ids, so
 * we run the same greedy longest-match strategy against `byWord`.
 */
export function segmentChinese(text: string): string[] {
  const characters = Array.from(text);
  const segments: string[] = [];
  let i = 0;

  while (i < characters.length) {
    let matched: string | null = null;
    const maxLength = Math.min(7, characters.length - i);
    for (let length = maxLength; length >= 1; length -= 1) {
      const candidate = characters.slice(i, i + length).join("");
      if (length === 1 || lookupExact(candidate).length > 0) {
        matched = candidate;
        i += length;
        break;
      }
    }
    if (!matched) {
      matched = characters[i];
      i += 1;
    }
    segments.push(matched);
  }

  return segments;
}

function searchChinese(query: string, limit: number): { hits: SearchHit[]; segments: string[] } {
  const trimmed = query.trim();
  const hits: SearchHit[] = [];

  for (const id of lookupExact(trimmed)) {
    hits.push(toHit(getSearchIndex().docs[id], "word", trimmed, true));
  }

  const segments = segmentChinese(trimmed);
  if (segments.length > 1 || hits.length === 0) {
    for (const segment of segments) {
      const ids = lookupExact(segment);
      if (ids.length > 0) {
        for (const id of ids) {
          const doc = getSearchIndex().docs[id];
          hits.push(toHit(doc, doc.length === 1 ? "character" : "word", segment, segment === trimmed));
        }
      } else if (Array.from(segment).length === 1) {
        // Nothing in CEDICT as a standalone headword: fall back to words that
        // contain the character, which is what people actually want.
        for (const id of getSearchIndex().charIndex.get(segment) ?? []) {
          const doc = getSearchIndex().docs[id];
          if (doc.length === 1) continue;
          hits.push(toHit(doc, "contains", segment, false));
        }
      }
    }
  }

  // Prefix matches as a last resort, so partial typing still feels alive.
  if (hits.length === 0 && trimmed.length >= 2) {
    for (const [word, ids] of getSearchIndex().byWord) {
      if (word.length > trimmed.length && word.startsWith(trimmed)) {
        for (const id of ids) {
          hits.push(toHit(getSearchIndex().docs[id], "word", trimmed, false));
        }
      }
    }
  }

  return { hits: hits.slice(0, limit * 4), segments };
}

function searchPinyin(query: string, limit: number): SearchHit[] {
  const key = pinyinSearchKey(query);
  if (!key) return [];
  const hits: SearchHit[] = [];

  for (const id of getSearchIndex().pinyinIndex.get(key) ?? []) {
    const doc = getSearchIndex().docs[id];
    hits.push(toHit(doc, "pinyin", query.trim(), true));
  }

  if (hits.length === 0 && key.length >= 2) {
    for (const [pinyinKey, ids] of getSearchIndex().pinyinIndex) {
      if (pinyinKey.length > key.length && pinyinKey.startsWith(key)) {
        for (const id of ids) {
          hits.push(toHit(getSearchIndex().docs[id], "pinyin", query.trim(), false));
        }
      }
    }
  }

  return hits.slice(0, limit * 4);
}

function searchEnglish(query: string, limit: number): SearchHit[] {
  const normalised = query.toLowerCase().trim();
  const tokens = normalised.split(/[^a-z'-]+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const hits: SearchHit[] = [];
  const exactToken = tokens[0];

  for (const id of getSearchIndex().glossIndex.get(exactToken) ?? []) {
    hits.push(toHit(getSearchIndex().docs[id], "english", exactToken, tokens.length === 1));
  }

  if (tokens.length > 1) {
    // Every token must match (as a token or as a prefix of one) for multi-word
    // queries — otherwise "to learn" returns every entry whose gloss starts with
    // "to". If nothing satisfies that, fall back to the first token alone.
    const candidates = new Map<number, number>();
    const strictMatches = new Set<number>();
    for (const token of tokens) {
      const exact = new Set<number>(getSearchIndex().glossIndex.get(token) ?? []);
      const prefix = new Set<number>();
      for (const [glossToken, ids] of getSearchIndex().glossIndex) {
        if (glossToken.startsWith(token) && glossToken !== token) {
          for (const id of ids) prefix.add(id);
        }
      }
      for (const id of exact) {
        candidates.set(id, (candidates.get(id) ?? 0) + 1);
      }
      for (const id of prefix) {
        candidates.set(id, (candidates.get(id) ?? 0) + 1);
      }
      if (strictMatches.size === 0) {
        for (const id of exact) strictMatches.add(id);
      } else {
        for (const id of [...strictMatches]) {
          if (!exact.has(id)) strictMatches.delete(id);
        }
      }
    }
    const strict: SearchHit[] = [];
    for (const [id, count] of candidates) {
      if (count !== tokens.length) continue;
      const hit = toHit(getSearchIndex().docs[id], "english", normalised, false);
      // Entries where every token matched a whole gloss word outrank entries
      // that only matched prefixes ("hello world" → 你好 before 喂).
      strict.push(strictMatches.has(id) ? { ...hit, score: hit.score - 20_000 } : hit);
    }
    if (strict.length > 0) return strict.sort((a, b) => a.score - b.score).slice(0, limit * 4);
  }

  if (hits.length === 0 && exactToken.length >= 2) {
    for (const [token, ids] of getSearchIndex().glossIndex) {
      if (token.startsWith(exactToken) && token !== exactToken) {
        for (const id of ids) {
          hits.push(toHit(getSearchIndex().docs[id], "english", exactToken, false));
        }
      }
      if (hits.length > limit * 4) break;
    }
  }

  return hits.slice(0, limit * 4);
}

export function detectMode(query: string): SearchMode {
  const trimmed = query.trim();
  if (!trimmed) return "empty";
  const hasHan = isHanText(trimmed);
  const hasLatin = /[a-z]/i.test(trimmed);
  if (hasHan && hasLatin) return "mixed";
  if (hasHan) return "chinese";
  // Latin queries are searched against both the pinyin and the English index —
  // "xue" is a valid pinyin key *and* the headword of no english gloss, while
  // "snow" is the reverse. The mode only reports which one is the better bet.
  const byPinyin = searchPinyin(trimmed, 1);
  const byEnglish = searchEnglish(trimmed, 1);
  return byEnglish.length > byPinyin.length ? "english" : "pinyin";
}

function searchLatin(query: string, limit: number): SearchHit[] {
  const pinyinHits = searchPinyin(query, limit);
  const englishHits = searchEnglish(query, limit);
  const merged = dedupe([...pinyinHits, ...englishHits]);
  // Give the interpretation that produced more matches a small edge.
  const bias = pinyinHits.length >= englishHits.length ? "pinyin" : "english";
  return merged
    .map((hit) => ({
      ...hit,
      score: hit.score + (hit.matchedOn === bias ? 0 : 50_000),
    }))
    .sort((a, b) => a.score - b.score || a.entry.id - b.entry.id)
    .slice(0, limit * 4);
}

export function search(rawQuery: string, limit = 60): SearchResponse {
  const query = rawQuery.trim();
  const mode = detectMode(query);

  if (mode === "empty") {
    return { query, mode, segments: [], hits: [], total: 0, truncated: false };
  }

  let hits: SearchHit[] = [];
  let segments: string[] = [];

  if (mode === "chinese") {
    const result = searchChinese(query, limit);
    hits = result.hits;
    segments = result.segments;
  } else if (mode === "pinyin" || mode === "english") {
    hits = searchLatin(query, limit);
    segments = [query];
  } else {
    // Mixed script: split into han and latin runs and search both.
    const hanRuns = query.match(/[\u3400-\u9fff\uf900-\ufaff]+/g) ?? [];
    const latinRuns = query.match(/[a-zü:1-5'-]+/gi) ?? [];
    for (const run of hanRuns) {
      const result = searchChinese(run, limit);
      hits.push(...result.hits);
      segments.push(...result.segments);
    }
    for (const run of latinRuns) {
      if (looksLikePinyin(run)) hits.push(...searchPinyin(run, limit));
      else hits.push(...searchEnglish(run, limit));
      segments.push(run);
    }
  }

  const deduped = dedupe(hits).sort((a, b) => a.score - b.score || a.entry.id - b.entry.id);

  return {
    query,
    mode,
    segments,
    hits: deduped.slice(0, limit),
    total: deduped.length,
    truncated: deduped.length > limit,
  };
}

/** Suggestions for the search field: headwords + pinyin prefixes. */
export function autocomplete(rawQuery: string, limit = 8): string[] {
  const query = rawQuery.trim();
  if (!query) return [];
  const mode = detectMode(query);

  if (mode === "chinese") {
    const words: string[] = [];
    for (const [word] of getSearchIndex().byWord) {
      if (word.startsWith(query) && word.length > query.length) words.push(word);
      if (words.length >= limit * 3) break;
    }
    return [...new Set(words)].slice(0, limit);
  }

  if (mode === "pinyin") {
    const key = pinyinSearchKey(query);
    const keys: string[] = [];
    for (const [pinyinKey] of getSearchIndex().pinyinIndex) {
      if (pinyinKey.startsWith(key) && pinyinKey !== key) keys.push(pinyinKey);
      if (keys.length >= limit * 3) break;
    }
    return keys.slice(0, limit);
  }

  const tokens: string[] = [];
  for (const [token] of getSearchIndex().glossIndex) {
    if (token.startsWith(query.toLowerCase()) && token !== query.toLowerCase()) tokens.push(token);
    if (tokens.length >= limit * 3) break;
  }
  return tokens.slice(0, limit);
}

export function getDocById(id: number): SearchDoc | null {
  const { docs } = getSearchIndex();
  return docs[id] ?? null;
}
