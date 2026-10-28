/**
 * Pinyin helpers.
 *
 * CC-CEDICT (via HanziJS) stores pinyin as numbered lowercase syllables:
 * `xue3 hua1`, `nu:3`, `lv4`, `zhong1 guo2`. A dictionary UI wants tone marks
 * (`xuě huā`) and a tone-number-free key for searching (`xue hua`).
 */

const TONE_MARKS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à", "a"],
  e: ["ē", "é", "ě", "è", "e"],
  i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"],
  u: ["ū", "ú", "ǔ", "ù", "u"],
  v: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

/** The one syllable that breaks the standard "a > o > e > last vowel" rule is `iu`/`ui`. */
const SPECIAL_FINALS: Array<[string, string]> = [
  ["iu", "u"],
  ["ui", "i"],
];

export function normaliseSyllable(raw: string): string {
  return raw
    .trim()
    .replace(/u:/gi, "ü")
    .replace(/v/gi, "ü")
    .replace(/5/g, "")
    .normalize("NFC");
}

/** `xue3` → `xuě`, `nu:3` → `nǚ`, `de5` → `de` */
export function syllableToMarks(raw: string): string {
  const syllable = normaliseSyllable(raw);
  const toneMatch = /([1-4])$/.exec(syllable);
  const tone = toneMatch ? Number(toneMatch[1]) : 0;
  const bare = syllable.replace(/[1-5]$/, "");
  if (!bare) return "";

  const letters = bare.split("");
  let targetIndex = -1;

  if (tone === 0) {
    // Neutral tone keeps the umlaut but adds no mark.
    return bare;
  }

  const special = SPECIAL_FINALS.find(([final]) => bare.endsWith(final));
  if (special) {
    targetIndex = bare.length - 1;
  } else {
    for (const vowel of ["a", "o", "e"]) {
      const idx = letters.indexOf(vowel);
      if (idx !== -1 && (targetIndex === -1 || idx < targetIndex)) {
        targetIndex = idx;
        break;
      }
    }
  }

  if (targetIndex === -1) {
    for (let i = letters.length - 1; i >= 0; i -= 1) {
      if (TONE_MARKS[letters[i]]) {
        targetIndex = i;
        break;
      }
    }
  }

  if (targetIndex === -1) return bare;
  const letter = letters[targetIndex];
  const marks = TONE_MARKS[letter];
  if (!marks) return bare;
  letters[targetIndex] = marks[tone - 1];
  return letters.join("");
}

/** `xue3 hua1` → `xuě huā` */
export function pinyinToMarks(pinyin: string): string {
  return pinyin
    .split(/\s+/)
    .filter(Boolean)
    .map(syllableToMarks)
    .join(" ");
}

/** `xue3 hua1` → `xue hua` — the key used for toneless pinyin search. */
export function pinyinToPlain(pinyin: string): string {
  return pinyin
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => normaliseSyllable(s).replace(/[1-5]$/, ""))
    .join(" ");
}

/** Splits `xue3hua1` written without spaces back into syllables. */
export function splitPinyinRun(run: string): string[] {
  return run.match(/[a-zü:]+[1-5]?/gi) ?? [];
}

/**
 * Turns any user-typed pinyin (with tone numbers, tone marks or neither) into
 * the space-free plain key used by the index: `Xuě Huā` → `xuehua`.
 */
export function pinyinSearchKey(input: string): string {
  const decomposed = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/u:/g, "ü")
    .replace(/v/g, "ü")
    .replace(/ü/g, "u")
    .replace(/[^a-z1-5]+/g, "");

  return decomposed.replace(/[1-5]/g, "");
}

const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/** CJK stroke symbols (㇀ ㉉ ㇏ …) — shapes rather than text, but glyphs all the same. */
export function isStrokeCharacter(char: string): boolean {
  const cp = char.codePointAt(0) ?? 0;
  return cp >= 0x31c0 && cp <= 0x31ef;
}

/** Han text, or a single CJK stroke symbol — anything worth looking up as a glyph. */
export function isGlyphText(text: string): boolean {
  if (isHanText(text)) return true;
  const characters = Array.from(text);
  return characters.length === 1 && isStrokeCharacter(characters[0]);
}

export function isHanCharacter(char: string): boolean {
  return HAN.test(char);
}

export function isHanText(text: string): boolean {
  return HAN.test(text);
}

export function countHanCharacters(text: string): number {
  return Array.from(text).filter(isHanCharacter).length;
}

/** Strips punctuation/casing so `Xue3` and `xue3` compare equal. */
export function normaliseLabel(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}
