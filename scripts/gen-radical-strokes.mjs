#!/usr/bin/env node
/**
 * Generates `src/lib/dictionary/radical-strokes.generated.json`: the stroke
 * count of every glyph in HanziJS' radical inventory (the 214 Kangxi radicals
 * plus their common layout variants).
 *
 * Stroke counts come from:
 *   1. the mirrored `stroke-counts.generated.json` (offline, exact),
 *   2. `hanzi-writer-data` on jsDelivr (same source the stroke animator uses),
 *   3. a curated fallback that maps layout variants (⺁, ⺅, ⻌ …) onto the base
 *      radical whose stroke count they share, because those supplement glyphs
 *      have no standalone stroke data.
 *
 *   node scripts/gen-radical-strokes.mjs
 *
 * The output is committed, so the app itself never needs the network.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const CDN = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1";
const OUT_FILE = path.join(
  process.cwd(),
  "src",
  "lib",
  "dictionary",
  "radical-strokes.generated.json",
);

/**
 * Variant glyph → base radical whose stroke count it shares. The supplement
 * glyphs (CJK Radicals Supplement, U+2E80–U+2EF3) are layout variants of the
 * Kangxi radicals; they have names like "SECOND ONE" / "CLIMATE …", and their
 * stroke counts match the base radical's drawn form.
 */
const VARIANT_BASE = {
  "⺀": "冫", // repeat (two dots = ice form)
  "⺁": "厂", // cliff
  "⺂": "乙", // second one
  "⺃": "乙", // second two
  "⺄": "乙", // second three
  "⺅": "人", // person
  "⺆": "冂", // box
  "⺇": "几", // table
  "⺈": "刀", // knife one
  "⺉": "刀", // knife two
  "⺊": "卜", // divination
  "⺋": "卩", // seal
  "⺌": "小", // small one
  "⺍": "小", // small two
  "⺎": "尢", // lame one
  "⺏": "尢", // lame two
  "⺐": "尢", // lame three
  "⺑": "尢", // lame four
  "⺒": "己", // snake / oneself
  "⺓": "幺", // thread / short tiny
  "⺔": "彐", // snout one
  "⺕": "彐", // snout two
  "⺗": "心", // heart two
  "⺘": "手", // hand
  "⺙": "攴", // rap / knock
  "⺛": "无", // choke / have not
  "⺜": "日", // sun
  "⺝": "月", // moon
  "⺞": "歹", // death
  "⺟": "毋", // mother / do not
  "⺠": "氏", // civilian (民 under 氏)
  "⺢": "水", // water two
  "⺣": "火", // fire
  "⺤": "爪", // paw one
  "⺥": "爪", // paw two
  "⺦": "木", // simplified half tree trunk
  "⺧": "牛", // cow
  "⺨": "犬", // dog
  "⺩": "王", // jade (王 form)
  "⺪": "疋", // bolt of cloth
  "⺫": "目", // eye
  "⺬": "示", // spirit one
  "⺭": "示", // spirit two
  "⺮": "竹", // bamboo
  "⺯": "糸", // silk
  "⺰": "纟", // C-simplified silk
  "⺱": "网", // net one
  "⺲": "网", // net two
  "⺳": "网", // net three
  "⺴": "网", // net four
  "⺵": "网", // mesh
  "⺶": "羊", // sheep
  "⺷": "羊", // ram
  "⺸": "羊", // ewe
  "⺹": "老", // old
  "⺺": "聿", // brush one
  "⺻": "聿", // brush two
  "⺼": "肉", // meat
  "⺽": "臼", // mortar
  "⺾": "艸", // grass one
  "⺿": "艸", // grass two
  "⻀": "艸", // grass three
  "⻁": "虍", // tiger
  "⻂": "衣", // clothes
  "⻃": "西", // west one
  "⻄": "西", // west two
  "⻅": "見", // C-simplified see
  "⻆": "角", // simplified horn
  "⻇": "角", // horn
  "⻈": "言", // C-simplified speech
  "⻉": "貝", // C-simplified shell
  "⻊": "足", // foot
  "⻋": "車", // C-simplified cart
  "⻌": "辵", // simplified walk
  "⻍": "辵", // walk one
  "⻎": "辵", // walk two
  "⻏": "邑", // city
  "⻐": "金", // C-simplified gold
  "⻑": "長", // long one
  "⻒": "長", // long two
  "⻓": "長", // C-simplified long
  "⻔": "門", // C-simplified gate
  "⻕": "阜", // mound one
  "⻖": "阜", // mound two
  "⻗": "雨", // rain
  "⻘": "青", // blue
  "⻙": "韋", // C-simplified tanned leather
  "⻚": "頁", // C-simplified leaf
  "⻛": "風", // C-simplified wind
  "⻜": "飛", // C-simplified fly
  "⻝": "食", // eat one
  "⻞": "食", // eat two
  "⻟": "食", // eat three
  "⻠": "食", // C-simplified eat
  "⻡": "首", // head
  "⻢": "馬", // C-simplified horse
  "⻣": "骨", // bone
  "⻤": "鬼", // ghost
  "⻥": "魚", // C-simplified fish
  "⻦": "鳥", // C-simplified bird
  "⻧": "鹵", // C-simplified salt
  "⻨": "麥", // simplified wheat
  "⻩": "黃", // simplified yellow
  "⻪": "黽", // C-simplified frog
  "⻫": "齊", // simplified even
  "⻬": "齊", // C-simplified even
  "⻭": "齒", // simplified tooth
  "⻮": "齒", // C-simplified tooth
  "⻯": "龍", // simplified dragon
  "⻰": "龍", // C-simplified dragon
  "⻱": "龜", // turtle
  "⻲": "龜", // simplified turtle
  "⻳": "龜", // C-simplified turtle
  "牜": "牛", // cow
  "覀": "西", // west
};

/** Kangxi radical strokes, by radical number — the classic 214 table. */
const KANGXI_STROKES = [
  1, 1, 1, 1, 1, 1, // 1–6
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, // 7–29
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // 30–60
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, // 61–94
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, // 95–117
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, // 118–146
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, // 147–166
  8, 8, 8, 8, 8, 8, 8, 8, 8, // 167–175
  9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, // 176–186
  10, 10, 10, 10, 10, 10, 10, 10, // 187–194
  11, 11, 11, 11, 11, 11, // 195–200
  12, 12, 12, 12, // 201–204
  13, 13, 13, 13, // 205–208
  14, 14, // 209–210
  15, // 211
  16, 16, // 212–213
  17, // 214
];

function hanziDataFile(name) {
  const root = path.dirname(require.resolve("hanzi/package.json"));
  return path.join(root, "lib", "data", name);
}

function parseExportedJson(file, open, close) {
  const raw = readFileSync(file, "utf8");
  const start = raw.indexOf(open);
  const end = raw.lastIndexOf(close);
  if (start === -1 || end === -1) throw new Error(`Bad data file ${file}`);
  return JSON.parse(raw.slice(start, end + 1));
}

async function cdnStrokes(glyph) {
  try {
    const response = await fetch(`${CDN}/${encodeURIComponent(glyph)}.json`);
    if (!response.ok) return null;
    const parsed = await response.json();
    return Array.isArray(parsed.strokes) && parsed.strokes.length > 0
      ? parsed.strokes.length
      : null;
  } catch {
    return null;
  }
}

async function main() {
  const radicals = parseExportedJson(hanziDataFile("radicalList.js"), "[", "]");
  const localCounts = JSON.parse(
    readFileSync(path.join(process.cwd(), "src", "lib", "dictionary", "stroke-counts.generated.json"), "utf8"),
  );

  /** glyph → strokes */
  const strokes = {};
  for (const glyph of radicals) {
    if (glyph in localCounts) strokes[glyph] = localCounts[glyph];
  }

  const missing = radicals.filter((glyph) => !(glyph in strokes));
  for (const glyph of missing) {
    const count = await cdnStrokes(glyph);
    if (count) strokes[glyph] = count;
  }

  // The canonical 214 radicals follow the classic Kangxi stroke table — the
  // counts every radical chart (and Pleco) groups by — rather than the modern
  // per-character counts that hanzi-writer-data mirrors for a handful of them
  // (e.g. 骨 9 vs 10, 瓦 4 vs 5).
  const canonical = radicals.slice(0, 214);
  canonical.forEach((glyph, index) => {
    strokes[glyph] = KANGXI_STROKES[index];
  });

  // Curated fallback: layout variants borrow their base radical's count. The
  // base may be a non-radical character (王, 西, …), so resolve it from the
  // local table or the CDN when needed.
  for (const glyph of radicals) {
    if (glyph in strokes) continue;
    const base = VARIANT_BASE[glyph];
    if (!base) continue;
    if (!(base in strokes)) {
      const baseCount = base in localCounts ? localCounts[base] : await cdnStrokes(base);
      if (baseCount) strokes[base] = baseCount;
    }
    if (base in strokes) strokes[glyph] = strokes[base];
  }

  const unresolved = radicals.filter((glyph) => !(glyph in strokes));
  if (unresolved.length > 0) {
    console.error(`Unresolved radical glyphs (${unresolved.length}): ${unresolved.join(" ")}`);
    process.exit(1);
  }

  // Keep the list order (215… variants) so the JSON stays stable across runs.
  const ordered = {};
  for (const glyph of radicals) ordered[glyph] = strokes[glyph];

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");

  const histogram = {};
  for (const value of Object.values(ordered)) histogram[value] = (histogram[value] ?? 0) + 1;
  console.log(`Wrote ${Object.keys(ordered).length} radical stroke counts to ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log("Histogram:", JSON.stringify(histogram));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
