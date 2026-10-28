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
import radicalStrokes from "./radical-strokes.generated.json";

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
  meaning: string;
  /** Classic Kangxi stroke count (variants follow their base radical). */
  strokes: number | null;
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
 * The 214 Kangxi radicals.
 *
 * HanziJS ships the canonical 214 followed by ~150 layout variants and a few
 * duplicates (⺲ appears twice, ⻳ is just 龜 again); the inventory we browse is
 * exactly the classic 214, so the list is truncated at the canonical block.
 */
const KANGXI_RADICAL_COUNT = 214;

export function getRadicals(): Radical[] {
  if (radicalCache) return radicalCache;
  const list = parseExportedJson<string[]>("radicalList.js", "[", "]");
  const meanings = getRadicalMeanings();
  const strokeCounts = radicalStrokes as Record<string, number>;
  radicalCache = list.slice(0, KANGXI_RADICAL_COUNT).map((glyph, index) => ({
    number: index + 1,
    glyph,
    meaning: meanings[glyph] ?? "",
    strokes: strokeCounts[glyph] ?? null,
  }));
  return radicalCache;
}

export function getRadicalMeaning(glyph: string): string {
  return getRadicalMeanings()[glyph] ?? "";
}

/** Look up a Kangxi radical record for any component glyph that is a radical. */
export function findRadicalMatch(candidates: string[]): Radical | null {
  const byGlyph = new Map(getRadicals().map((r) => [r.glyph, r]));
  for (const candidate of candidates) {
    const hit = byGlyph.get(candidate);
    if (hit) return hit;
  }
  return null;
}
