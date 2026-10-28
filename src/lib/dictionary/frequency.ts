/**
 * Character frequency + radical data.
 *
 * Both come out of the `hanzi` package: the Jun Da frequency list (ranked, with
 * a per-character pinyin + gloss) and the Kangxi radical tables. HanziJS exposes
 * the frequency list by position, but we need rank **by character** (for
 * "common character" badges and relevance sorting), so we parse the shipped
 * table once.
 */

import { readFileSync } from "node:fs";

import { hanziDataFile } from "../hanzi-paths";
import kangxiRadicals from "./kangxi-radicals.json";

function readRaw(file: string): string {
  return readFileSync(hanziDataFile(file), "utf8");
}

function readTemplateLiteral(file: string): string {
  const raw = readRaw(file);
  const start = raw.indexOf("`");
  const end = raw.lastIndexOf("`");
  if (start === -1 || end === -1) throw new Error(`Bad data file ${file}`);
  return raw
    .slice(start + 1, end)
    .replace(/\\`/g, "`")
    .replace(/\\\$\{/g, "${")
    .replace(/\\\\/g, "\\");
}

function parseExportedJson<T>(file: string, open: string, close: string): T {
  const raw = readRaw(file);
  const start = raw.indexOf(open);
  const end = raw.lastIndexOf(close);
  if (start === -1 || end === -1) throw new Error(`Bad data file ${file}`);
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

export type FrequencyRecord = {
  rank: number;
  character: string;
  count: number;
  pinyin: string;
  meaning: string;
};

let frequencyCache: Map<string, FrequencyRecord> | null = null;

export function getFrequencyTable(): Map<string, FrequencyRecord> {
  if (frequencyCache) return frequencyCache;

  const table = new Map<string, FrequencyRecord>();
  for (const line of readTemplateLiteral("frequencyjunda.txt.js").split("\n")) {
    if (!line) continue;
    const cols = line.split("\t");
    if (cols.length < 5) continue;
    const rank = Number(cols[0]);
    if (!Number.isFinite(rank)) continue;
    table.set(cols[1], {
      rank,
      character: cols[1],
      count: Number(cols[2]) || 0,
      pinyin: cols[4] ?? "",
      meaning: (cols[5] ?? "").replace(/\//g, "; "),
    });
  }

  frequencyCache = table;
  return table;
}

export function getCharacterFrequency(character: string): FrequencyRecord | null {
  if (Array.from(character).length !== 1) return null;
  return getFrequencyTable().get(character) ?? null;
}

export type Radical = {
  /** Position in the Kangxi radical list (1-based). */
  number: number;
  glyph: string;
  /** English gloss of the radical. */
  meaning: string;
  pinyin: string;
  /**
   * Stroke count of the radical in the form shown (simplified where one exists),
   * which is what that table counts.
   */
  strokes: number | null;
  /** Other forms of the same radical (traditional or layout variants). */
  variants: string[];
};

let radicalCache: Radical[] | null = null;
let radicalMeaningCache: Record<string, string> | null = null;

export function getRadicalMeanings(): Record<string, string> {
  if (!radicalMeaningCache) {
    radicalMeaningCache = parseExportedJson<Record<string, string>>(
      "radicalListWithMeaning.js",
      "{",
      "}",
    );
  }
  return radicalMeaningCache;
}

/**
 * The 214 Kangxi radicals, as the classic inventory table defines them: the
 * simplified form where one exists (户 not 戶, 纟 not 糸, 犭 not 犬), its English
 * name, its pinyin, the stroke count of that form, and the traditional / variant
 * forms.
 *
 * This is a static table on purpose: HanziJS' `radicalList.js` mixes the classic
 * 214 with ~150 layout variants and duplicates, which is not the inventory a
 * radical browser should show.
 */
export function getRadicals(): Radical[] {
  if (radicalCache) return radicalCache;
  radicalCache = kangxiRadicals as Radical[];
  return radicalCache;
}

export function getRadicalMeaning(glyph: string): string {
  const radical = findRadicalMatch([glyph]);
  if (radical) return radical.meaning;
  return getRadicalMeanings()[glyph] ?? "";
}

/**
 * Look up a Kangxi radical record for any component glyph that is a radical —
 * the canonical form or one of its variants (氵 → 水, 忄 → 心, 讠 → 言).
 */
let radicalIndex: Map<string, Radical> | null = null;

export function findRadicalMatch(candidates: string[]): Radical | null {
  if (!radicalIndex) {
    const index = new Map<string, Radical>();
    for (const radical of getRadicals()) {
      index.set(radical.glyph, radical);
      for (const variant of radical.variants) {
        if (!index.has(variant)) index.set(variant, radical);
      }
    }
    radicalIndex = index;
  }
  for (const candidate of candidates) {
    const hit = radicalIndex.get(candidate);
    if (hit) return hit;
  }
  return null;
}
