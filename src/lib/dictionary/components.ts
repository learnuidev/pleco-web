/**
 * Learning components: what a character is made of, and how much of that the
 * user already knows.
 *
 * A character's components are the union of all four HanziJS decomposition
 * levels — once, radical, graphical and primitive — because the radical pass
 * gives the meaningful radicals (未 = 木 + 一, 为 = 力 + ⺀), the graphical pass
 * surfaces pieces it folds together, and the once/primitive passes add the first
 * split and the final building blocks. Bare stroke symbols are skipped, the
 * character is not its own component, and same-meaning radical forms (丶 / ⺀)
 * collapse into one component shown by its canonical form (⺀ → 丶).
 */

import { getRadicals } from "./frequency";
import { decompose, radicalMeaning } from "../hanzi";

/** CJK stroke symbols (㇇ ㇏ ㇒ …) are not learnable components. */
export function isLearnable(glyph: string): boolean {
  const cp = glyph.codePointAt(0) ?? 0;
  return cp < 0x31c0 || cp > 0x31ef;
}

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
 * The character's components as `key → display glyph`, canonicalised and with
 * the character itself removed.
 */
export function componentsOf(character: string): Map<string, string> {
  const decomposition = decompose(character);
  const components = new Map<string, string>();
  const add = (glyph: string | undefined) => {
    if (!glyph || glyph === "No glyph available" || glyph === character) return;
    if (!isLearnable(glyph)) return;
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
