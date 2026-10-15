/**
 * Client-safe mirrors of the server-side pinyin helpers. Kept separate so the
 * browser bundle never pulls in the Node-only HanziJS bridge.
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

const SPECIAL_FINALS = ["iu", "ui"];

export function syllableToMarks(raw: string): string {
  const syllable = raw.trim().replace(/u:/gi, "ü").replace(/v/gi, "ü");
  const toneMatch = /([1-4])$/.exec(syllable);
  const tone = toneMatch ? Number(toneMatch[1]) : 0;
  const bare = syllable.replace(/[1-5]$/, "");
  if (!bare || tone === 0) return bare;

  const letters = bare.split("");
  let targetIndex = -1;

  if (SPECIAL_FINALS.some((final) => bare.endsWith(final))) {
    targetIndex = bare.length - 1;
  } else {
    for (const vowel of ["a", "o", "e"]) {
      const index = bare.indexOf(vowel);
      if (index !== -1) {
        targetIndex = index;
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

  const marks = targetIndex === -1 ? undefined : TONE_MARKS[letters[targetIndex]];
  if (!marks) return bare;
  letters[targetIndex] = marks[tone - 1];
  return letters.join("");
}

export function pinyinToMarksClient(pinyin: string): string {
  return pinyin
    .split(/\s+/)
    .filter(Boolean)
    .map(syllableToMarks)
    .join(" ");
}

export function pinyinToPlainClient(pinyin: string): string {
  return pinyin
    .split(/\s+/)
    .filter(Boolean)
    .map((syllable) => syllable.replace(/u:/gi, "ü").replace(/[1-5]$/, ""))
    .join(" ");
}

const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

export function isHanCharacter(char: string): boolean {
  return HAN.test(char);
}

export function isHanText(text: string): boolean {
  return HAN.test(text);
}

export function hanCharacters(text: string): string[] {
  return Array.from(text).filter(isHanCharacter);
}

/** Groups a mixed string into runs of han / non-han, for clickable text. */
export function splitRuns(text: string): Array<{ text: string; isHan: boolean; index: number }> {
  const characters = Array.from(text);
  const runs: Array<{ text: string; isHan: boolean; index: number }> = [];
  let index = 0;

  for (const char of characters) {
    const isHan = isHanCharacter(char);
    const previous = runs[runs.length - 1];
    if (previous && previous.isHan === isHan) previous.text += char;
    else runs.push({ text: char, isHan, index });
    index += 1;
  }

  return runs;
}
