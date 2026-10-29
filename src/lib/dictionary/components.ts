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
 * The graphical and primitive passes also emit bare stroke shapes (㇒, ㇆ …) for
 * pieces that are strokes rather than characters. Those are decoded to the basic
 * stroke they draw — the Kangxi radicals 一 丨 丿 丶 乙 — before they enter the set,
 * so a 撇 inside 的 counts as 丿, the radical a learner can actually study. The
 * same decoding feeds the dictionary's decomposition views, so the Graphical
 * panel reads 丿 rather than ㇒. The character is not its own component, and
 * same-meaning radical forms (丶 / ⺀) collapse into one component shown by its
 * canonical form (⺀ → 丶).
 */

import { getRadicals } from "./frequency";
import { decompose, radicalMeaning } from "../hanzi";

/**
 * Components are compared by meaning for radicals, so learning 丶 covers ⺀ and
 * one form of a radical covers its other forms; anything else compares by glyph.
 * Stroke tokens resolve through their decoded basic stroke first, so learning
 * the shape ㇒ and learning the radical 丿 are the same thing.
 */
export function componentKey(glyph: string): string {
  const token = STROKE_TOKENS[glyph] ?? glyph;
  const meaning = radicalMeaning(token);
  return meaning && meaning !== "N/A" ? `radical:${meaning.toLowerCase()}` : token;
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
 * Stroke and shape tokens → the basic stroke they draw. The CJK Strokes block
 * (U+31C0–U+31EF) is not text: HanziJS emits those from the graphical and
 * primitive passes (㇒ inside 的, ㇆ inside 为), and it borrows the katakana コ as a
 * fold shape (己 = コ + 乚). Each decodes to one of the five Kangxi stroke radicals.
 */
const STROKE_TOKENS: Record<string, string> = {
  "㇀": "一", // 提, a rising horizontal
  "㇁": "乙", // 弯钩
  "㇂": "乙", // 斜钩
  "㇃": "乙", // 扁斜钩
  "㇄": "乙", // 竖弯
  "㇅": "乙", // 横折折
  "㇆": "乙", // 横折钩
  "㇇": "乙", // 横撇
  "㇈": "乙", // 横折弯钩
  "㇉": "乙", // 竖折弯钩
  "㇊": "乙", // 横折提
  "㇋": "乙", // 横折撇
  "㇌": "乙", // 横撇弯钩
  "㇍": "乙", // 横折弯
  "㇎": "乙", // 横折折折
  "㇏": "丶", // 捺
  "㇐": "一", // 横
  "㇑": "丨", // 竖
  "㇒": "丿", // 撇
  "㇓": "丿", // 竖撇
  "㇔": "丶", // 点
  "㇕": "乙", // 横折
  "㇖": "乙", // 横钩
  "㇗": "乙", // 竖折
  "㇘": "乙", // 竖弯折
  "㇙": "乙", // 竖提
  "㇚": "乙", // 竖钩
  "㇛": "乙", // 撇点
  "㇜": "乙", // 撇折
  "㇝": "丶", // 提捺
  "㇞": "乙", // 竖折折
  "㇟": "乙", // 竖弯钩
  "㇠": "乙", // 横斜弯钩
  "㇡": "乙", // 横折折折钩
  "㇢": "乙", // 撇钩
  "㇣": "乙", // 圈
  "コ": "乙", // 横折 — HanziJS uses the katakana コ as a shape token (己 = コ + 乚)
};

/**
 * A glyph a learner can open and study: an ideograph (any block), or one of the
 * radical forms the decompositions use (⺀ ⻊ …). Stroke tokens and the synthetic
 * glyphs HanziJS invents for pieces with no character of their own (𲰸, "⺈ + 田")
 * are not, and get decoded below.
 */
function isStudyable(glyph: string): boolean {
  const code = glyph.codePointAt(0);
  if (code === undefined) return false;
  return (
    (code >= 0x2e80 && code <= 0x2eff) || // CJK radical forms
    (code >= 0x3400 && code <= 0x4dbf) || // CJK extension A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK unified ideographs
    (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility ideographs
    (code >= 0x20000 && code <= 0x323af) // CJK extensions B–H
  );
}

/** Every distinct glyph HanziJS produces for one character at its four levels. */
function decompositionGlyphs(character: string): string[] {
  const decomposition = decompose(character);
  const seen = new Set<string>();
  for (const level of [
    decomposition?.components1, // once
    decomposition?.components2, // radical
    decomposition?.components3, // graphical
    decomposition?.components4, // primitive
  ]) {
    for (const glyph of level ?? []) {
      if (!glyph || glyph === "No glyph available" || glyph === character) continue;
      seen.add(glyph);
    }
  }
  return [...seen];
}

/**
 * Turn one decomposition piece into the component(s) a learner can study.
 *
 * Stroke tokens decode to the basic stroke they draw, so a 撇 (㇒) inside 的
 * counts as 丿. A synthetic glyph expands to the pieces it is built from — HanziJS
 * defines 𲰸 as "⺈ + 田", which is exactly the body of 鱼 — recursively, so instead
 * of filtering these pieces out they are folded into the real components around
 * them. Anything that survives both stays as itself: nothing is dropped.
 */
function decodeGlyphs(glyph: string, depth = 0): string[] {
  const stroke = STROKE_TOKENS[glyph];
  if (stroke) return [stroke];
  if (isStudyable(glyph) || depth >= 2) return [glyph];

  const parts = decompositionGlyphs(glyph);
  if (parts.length === 0) return [glyph];

  const decoded = parts.flatMap((part) => decodeGlyphs(part, depth + 1));
  return decoded.length > 0 ? decoded : [glyph];
}

/**
 * Decode one decomposition level for display: the same stroke-token and synthetic
 * glyph handling the learned equation uses, so the dictionary's Graphical view
 * shows 丿 where HanziJS emitted ㇒, and ⺈ + 田 where it emitted 𲰸.
 */
export function decodeComponentList(glyphs: string[]): string[] {
  const decoded: string[] = [];
  for (const glyph of glyphs) {
    if (!glyph || glyph === "No glyph available") continue;
    for (const value of decodeGlyphs(glyph)) {
      if (!decoded.includes(value)) decoded.push(value);
    }
  }
  return decoded;
}

/**
 * The character's components as `key → display glyph`, canonicalised and with
 * the character itself removed. This is the set the learned percentage counts.
 */
export function componentsOf(character: string): Map<string, string> {
  const components = new Map<string, string>();
  const add = (glyph: string) => {
    if (glyph === character) return;
    const key = componentKey(glyph);
    if (!components.has(key)) components.set(key, canonicalGlyph(key) ?? glyph);
  };

  for (const glyph of decodeComponentList(decompositionGlyphs(character))) add(glyph);
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
