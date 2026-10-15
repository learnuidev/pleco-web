#!/usr/bin/env node
/**
 * Mirrors stroke-order data from the `hanzi-writer-data` package (the exact data
 * set hanzi-writer renders) into `public/stroke-data/`, so the app can animate
 * characters offline. The client falls back to the jsDelivr copy for anything
 * not mirrored here.
 *
 *   node scripts/fetch-stroke-data.mjs            # curated HSK 1–3 + common set
 *   node scripts/fetch-stroke-data.mjs 你好世界    # explicit characters
 *   node scripts/fetch-stroke-data.mjs --all      # every character with data
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CDN = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1";
const OUT_DIR = path.join(process.cwd(), "public", "stroke-data");
const CONCURRENCY = 16;

const HSK_CORE = `
爱八爸吧杯北备本比别不菜茶差长唱车吃出穿船床次从错答打大大学到道的得等地点电脑电影东西都读对多饿儿二发饭房间飞非分风服父干高告哥歌个给跟工公共公司狗姑故关贵国果过还孩海汉好号喝和很红候后湖互花话坏欢黄回会活火机鸡蛋几记家间见件教叫觉街姐介今紧进京经九酒就旧句开看考可课刻客空口哭快块来蓝老累了冷里力俩连脸练凉两亮了零六楼路旅绿妈麻马吗买卖满忙猫么没美妹门们迷米面民明名母目拿哪那男难呢能你年念女朋漂票品七起气前钱桥切轻请区去全然让热人认日容肉三色山商上少社谁身深生声师十什时识史使世事市试题手书数树水睡说思四送速算所他她它太汤糖特题天条听同头图外万完王往忘为位文问我无五午西希习洗喜下先现想小笑些写谢新心信星行姓休学雪呀言眼羊样药要也业一衣医已以意因音应该用友有右鱼雨语元员远院月阅读再在早怎站找这着真正知只中钟种重周住助字自走足最左作做坐
`.trim();

const EXTRA = `
的是不了在人有我他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可里后小么心多天而能好都然没日于起还发成事只作当想看文无开手用主行方又如前所本见经头面公同已老从动两知民样现分将外但身些与高意进把法此实回二理美点明其种声全工己话向情部正名定力机给几很业间被电第门相次东政海口使教西再平真听世气信北关并内数白风马水
`.trim();

const MANUAL = "你好世界中文学习写字笔画顺序语文";

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const values = argv.filter((a) => !a.startsWith("--"));
  return { all: flags.has("--all"), values };
}

function uniqueCharacters(text) {
  const chars = [];
  const seen = new Set();
  for (const char of Array.from(text)) {
    if (/\s/.test(char)) continue;
    if (!/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(char)) continue;
    if (seen.has(char)) continue;
    seen.add(char);
    chars.push(char);
  }
  return chars;
}

let allCharactersCache = null;

/** The full list of characters hanzi-writer-data ships. */
async function allCharacters() {
  if (allCharactersCache) return allCharactersCache;
  const response = await fetch(`${CDN}/all.json`);
  if (!response.ok) throw new Error("Could not download the hanzi-writer-data index");
  const data = await response.json();
  allCharactersCache = Object.keys(data).filter((key) => key.length === 1);
  return allCharactersCache;
}

async function fetchOne(character) {
  const response = await fetch(`${CDN}/${encodeURIComponent(character)}.json`);
  if (!response.ok) return null;
  const text = await response.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.strokes) || parsed.strokes.length === 0) return null;
  await writeFile(path.join(OUT_DIR, `${character}.json`), text, "utf8");
  return parsed.strokes.length;
}

async function main() {
  const { all, values } = parseArgs(process.argv.slice(2));

  await mkdir(OUT_DIR, { recursive: true });

  let characters;
  if (all) {
    characters = await allCharacters();
  } else if (values.length > 0) {
    characters = uniqueCharacters(values.join(""));
  } else {
    characters = uniqueCharacters(`${HSK_CORE}${EXTRA}${MANUAL}`);
  }

  let done = 0;
  let failed = 0;
  const queue = [...characters];

  async function worker() {
    while (queue.length > 0) {
      const char = queue.shift();
      if (!char) return;
      try {
        const strokes = await fetchOne(char);
        if (strokes === null) failed += 1;
        else done += 1;
      } catch {
        failed += 1;
      }
      if ((done + failed) % 25 === 0) {
        process.stdout.write(`  ${done + failed}/${characters.length}\r`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".json") && f !== "manifest.json");
  const mirrored = new Set(files.map((f) => f.replace(/\.json$/, "")));

  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(
      {
        source: CDN,
        generatedAt: new Date().toISOString(),
        count: mirrored.size,
        characters: [...mirrored].sort(),
      },
      null,
      0,
    ),
    "utf8",
  );

  console.log(
    `\nStroke data: ${done} fetched, ${failed} unavailable. ${mirrored.size} characters mirrored in public/stroke-data.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
