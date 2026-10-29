/**
 * Learning components: what a character is made of, and how much of that the
 * user already knows.
 *
 * A character's components are the union of all four HanziJS decomposition levels
 * — once, radical, graphical and primitive — because the radical pass gives the
 * meaningful radicals (未 = 木 + 一, 为 = 力 + ⺀), the graphical pass surfaces
 * pieces it folds together, and the once/primitive passes add the first split and
 * the final building blocks.
 *
 * The graphical pass also emits shapes nobody studies — bare strokes (㇒, ㇆ …)
 * and stray layout glyphs (the katakana コ) — so glyphs outside the ideograph and
 * radical-form ranges are dropped. The character is not its own component, and
 * same-meaning radical forms (丶 / ⺀) collapse into one component shown by its
 * canonical form (⺀ → 丶).
 */

import { getRadicals } from "./frequency";
import { decompose, radicalMeaning } from "../hanzi";

/**
 * Components are compared by meaning for radicals, so learning 丶 covers ⺀ and
 * one form of a radical covers its other forms; anything else compares by glyph.
 */
export function componentKey(glyph: string): string {
  const meaning = radicalMeaning(glyph);
  return meaning && meaning !== "N/A" ? `radical:${meaning.toLowerCase()}` : glyph;
}

/** The canonical glyph for a component key, so ⺀ shows and links as 丶. */
let canonicalByKey: Map<string, string> | null = null;

export function canonicalGlyph(key: string): string | null {
  if (!canonicalByKey) {
    const map = new Map<string, string>();
    for (const radical of getRadicals()) {
      const glyphs = [radical.glyph, ...radical.variants.map((variant) => variant.glyph)];
      for (const glyph of glyphs) {
        const value = componentKey(glyph);
        if (!map.has(value)) map.set(value, radical.glyph);
      }
    }
    canonicalByKey = map;
  }
  return canonicalByKey.get(key) ?? null;
}

/** What the user knows, compared by component key (so 丶 covers ⺀). */
export function taughtKeys(learned: string[]): Set<string> {
  return new Set(learned.map(componentKey));
}

/**
 * Whether a decomposition glyph is a component a learner can actually study:
 * ideographs, their extension blocks, and the radical forms the decompositions
 * use (⺀ ⻊ …). Bare strokes (CJK Strokes, U+31C0–U+31EF) and stray layout glyphs
 * (the katakana コ, U+30B3) fall outside and are skipped.
 */
function isComponentGlyph(glyph: string): boolean {
  const code = glyph.codePointAt(0);
  if (code === undefined) return false;
  return (
    (code >= 0x2e80 && code <= 0x2eff) || // CJK radical forms (⺀ ⻊ …)
    (code >= 0x3400 && code <= 0x4dbf) || // CJK extension A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK unified ideographs
    (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility ideographs
    (code >= 0x20000 && code <= 0x2fa1f) || // extensions B–F and compatibility
    (code >= 0x30000 && code <= 0x323af) // extensions G–H
  );
}

/**
 * The character's components as `key → display glyph`, canonicalised and with
 * the character itself removed. This is the set the learned percentage counts.
 */
export function componentsOf(character: string): Map<string, string> {
  const decomposition = decompose(character);
  const components = new Map<string, string>();
  const add = (glyph: string | undefined) => {
    if (!glyph || glyph === "No glyph available" || glyph === character) return;
    if (!isComponentGlyph(glyph)) return;
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
  return components;
}

/**
 * How much of a character is already learned, and what is still missing. The
 * `missing` value is the count of unlearned components, which is the
 * tie-breaker when two characters share a percentage.
 */
export function coverageOf(
  character: string,
  taught: Set<string>,
): { percent: number; missing: number } {
  const components = componentsOf(character);
  if (components.size === 0) return { percent: 0, missing: 0 };
  let missing = 0;
  for (const key of components.keys()) if (!taught.has(key)) missing += 1;
  return {
    percent: Math.round(((components.size - missing) / components.size) * 100),
    missing,
  };
}
