/**
 * Per-character profile: decomposition (all four HanziJS levels + trees),
 * components with their radical meanings, Jun Da frequency, stroke outline data
 * and phonetic-regularity analysis.
 */

import { getDictionary } from "./cedict";
import { findRadicalMatch, getCharacterFrequency } from "./frequency";
import { getDocById, getSearchIndex } from "./search";
import { loadStrokeDataSync } from "./stroke-data";
import type { CharacterInfo, ComponentInfo, PhoneticGroup } from "./types";
import {
  componentCharacters,
  componentExists,
  decompose,
  decompositionTree,
  isPrimitive,
  phoneticRegularity,
  radicalMeaning,
  readings,
} from "../hanzi";
import { pinyinToMarks } from "../pinyin";

const NO_GLYPH = "No glyph available";

function isRealGlyph(glyph: string | undefined | null): boolean {
  return Boolean(glyph) && glyph !== NO_GLYPH;
}
const MAX_WORDS_WITH_CHARACTER = 24;
const MAX_COMPONENT_EXAMPLES = 12;
const MAX_USED_IN = 96;

export function canonicalCharacterEntry(glyph: string) {
  const { entries } = getDictionary();
  return entries.find((e) => e.simplified === glyph) ?? null;
}

/**
 * The characters that use `glyph` as a building block, commonest first.
 *
 * Only radicals and primitives are worth listing: for an ordinary character the
 * reverse index is empty (or noise), and it keeps entry payloads small.
 */
function charactersUsing(glyph: string, isBuildingBlock: boolean): CharacterInfo["usedIn"] {
  if (!isBuildingBlock) return null;
  const list = componentCharacters(glyph);
  if (list.length === 0) return null;

  const ranked = [...list].sort((a, b) => {
    const rankA = getCharacterFrequency(a)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = getCharacterFrequency(b)?.rank ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });

  return {
    total: list.length,
    characters: ranked.slice(0, MAX_USED_IN).map((character) => {
      const frequency = getCharacterFrequency(character);
      return {
        glyph: character,
        rank: frequency?.rank ?? null,
        pinyin: frequency?.pinyin ? pinyinToMarks(frequency.pinyin.split("/")[0]) : "",
        meaning: frequency?.meaning ?? "",
      };
    }),
  };
}

export function buildCharacterInfo(glyph: string): CharacterInfo {
  const decomposition = decompose(glyph);

  const primitiveComponents = decomposition?.components4 ?? decomposition?.components2 ?? [];
  const components: ComponentInfo[] = [];

  for (const component of primitiveComponents) {
    const hasGlyph = component !== NO_GLYPH && component.length > 0;
    const radical = findRadicalMatch([component]);
    let usageCount: number | null = null;
    let examples: string[] = [];

    if (hasGlyph && componentExists(component)) {
      const all = componentCharacters(component);
      usageCount = all.length;
      examples = all.slice(0, MAX_COMPONENT_EXAMPLES);
    }

    components.push({
      glyph: component,
      meaning: radical ? radical.meaning : radicalMeaning(component),
      isRadical: Boolean(radical),
      radicalNumber: radical?.number ?? null,
      isPrimitive: hasGlyph ? isPrimitive(component) : false,
      usageCount,
      examples,
    });
  }

  const frequency = getCharacterFrequency(glyph);

  const singleEntryId = (getSearchIndex().byWord.get(glyph) ?? []).find((candidate) => {
    const doc = getDocById(candidate);
    return doc !== null && doc.entry.simplified === glyph;
  });
  const singleDoc = singleEntryId === undefined ? null : getDocById(singleEntryId);

  const phonetic = phoneticRegularity(glyph);
  const phoneticGroups: PhoneticGroup[] = [];
  if (phonetic) {
    for (const [reading, value] of Object.entries(phonetic)) {
      const matches = value.component
        .map((component, index) => ({
          component,
          regularity: value.regularity[index] ?? 0,
          componentPinyin: pinyinToMarks(value.phoneticpinyin[index] ?? ""),
        }))
        .filter((match) => match.regularity > 0)
        .sort((a, b) => a.regularity - b.regularity);
      if (matches.length > 0) {
        phoneticGroups.push({ reading: pinyinToMarks(reading), matches });
      }
    }
    phoneticGroups.sort((a, b) => a.reading.localeCompare(b.reading));
  }

  const strokes = loadStrokeDataSync(glyph);

  const wordsWithCharacter: CharacterInfo["wordsWithCharacter"] = [];
  const seenWordIds = new Set<number>();
  for (const id of getSearchIndex().charIndex.get(glyph) ?? []) {
    const doc = getDocById(id);
    // A word can contain the same character twice (e.g. 学学-like repeats), so
    // the char index can yield the same entry more than once.
    if (!doc || doc.length !== 2 || seenWordIds.has(doc.entry.id)) continue;
    seenWordIds.add(doc.entry.id);
    wordsWithCharacter.push(doc.entry);
    if (wordsWithCharacter.length >= MAX_WORDS_WITH_CHARACTER) break;
  }

  const isBuildingBlock =
    findRadicalMatch([glyph]) !== null || (isRealGlyph(glyph) && isPrimitive(glyph));

  return {
    glyph,
    pinyin: singleDoc?.pinyinMarks ?? null,
    readings: readings(glyph).map((reading) => pinyinToMarks(reading)),
    definition: singleDoc ? singleDoc.entry.definition.split("/").filter(Boolean).join("; ") : null,
    decomposition: {
      once: decomposition?.components1 ?? [],
      radical: decomposition?.components2 ?? [],
      graphical: decomposition?.components3 ?? [],
      primitive: decomposition?.components4 ?? [],
    },
    tree: {
      primitive: decompositionTree(glyph, "primitive"),
      graphical: decompositionTree(glyph, "graphical"),
    },
    components,
    frequency: frequency
      ? {
          rank: frequency.rank,
          count: frequency.count,
          percentile: null,
          meaning: frequency.meaning,
        }
      : null,
    strokes,
    strokeCount: strokes ? strokes.strokes.length : null,
    phoneticGroups,
    wordsWithCharacter,
    usedIn: charactersUsing(glyph, isBuildingBlock),
  };
}
