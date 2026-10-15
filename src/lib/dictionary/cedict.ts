/**
 * CC-CEDICT access layer.
 *
 * The dictionary text ships inside the `hanzi` npm package as a huge JS string
 * (`hanzi/lib/data/cedict_ts.u8.js`). HanziJS compiles it into two plain object
 * maps, which is great for exact lookups but useless for the kind of ranked,
 * prefix and reverse search a Pleco-style dictionary needs. So we parse the same
 * shipped text once and keep it in a flat array we can index freely, while every
 * linguistic operation (decomposition, phonetics, segmentation) still goes
 * through HanziJS itself.
 */

import { readFileSync } from "node:fs";

import { hanziDataFile } from "../hanzi-paths";

export type DictionaryEntry = {
  /** Stable index into the parsed CEDICT array. */
  id: number;
  traditional: string;
  simplified: string;
  /** Space separated numbered pinyin, e.g. `xue3 hua1`. */
  pinyin: string;
  /** Slash delimited english glosses, e.g. `snow/snowfall`. */
  definition: string;
};

export type Dictionary = {
  entries: DictionaryEntry[];
  /** CC-CEDICT `#! date=` header value. */
  version: string;
  /** Number of parsed lines. */
  count: number;
};

function cedictPath(): string {
  return hanziDataFile("cedict_ts.u8.js");
}

/**
 * The data file is `module.exports = \`...\``. We could `require()` it, but the
 * template literal contains backticks escaped as \` and interpolations escaped
 * as \${. Reading the raw bytes and unescaping those two sequences is both
 * faster and avoids materialising a second 7 MB JS module graph.
 */
function unescapeTemplateLiteral(source: string): string {
  const start = source.indexOf("`");
  const end = source.lastIndexOf("`");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unexpected CEDICT data file format");
  }
  return source
    .slice(start + 1, end)
    .replace(/\\`/g, "`")
    .replace(/\\\$\{/g, "${")
    .replace(/\\\\/g, "\\");
}

let cached: Dictionary | null = null;

export function getDictionary(): Dictionary {
  if (cached) return cached;

  const raw = readFileSync(cedictPath(), "utf8");
  const text = unescapeTemplateLiteral(raw);
  const lines = text.split(/\r?\n/);

  const entries: DictionaryEntry[] = [];
  let version = "unknown";

  for (const line of lines) {
    if (line.length === 0) continue;
    if (line.charCodeAt(0) === 35 /* # */) {
      const match = /^#!\s*date=(\S+)/.exec(line);
      if (match) version = match[1];
      continue;
    }

    // `TRAD SIMP [pin1 yin1] /def/def/`
    const firstSpace = line.indexOf(" ");
    if (firstSpace === -1) continue;
    const secondSpace = line.indexOf(" ", firstSpace + 1);
    if (secondSpace === -1) continue;
    const bracketStart = line.indexOf("[", secondSpace);
    const bracketEnd = line.indexOf("]", bracketStart);
    if (bracketStart === -1 || bracketEnd === -1) continue;
    const defStart = line.indexOf("/", bracketEnd);
    if (defStart === -1) continue;
    const defEnd = line.lastIndexOf("/");
    if (defEnd <= defStart) continue;

    entries.push({
      id: entries.length,
      traditional: line.slice(0, firstSpace),
      simplified: line.slice(firstSpace + 1, secondSpace),
      pinyin: line.slice(bracketStart + 1, bracketEnd),
      definition: line.slice(defStart + 1, defEnd),
    });
  }

  cached = { entries, version, count: entries.length };
  return cached;
}

export function glosses(definition: string): string[] {
  return definition.split("/").filter(Boolean);
}
