import { NextResponse } from "next/server";

import { detectMode, getDocById, getSearchIndex, segmentChinese } from "@/lib/dictionary/search";
import { isHanText, pinyinToMarks } from "@/lib/pinyin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SegmentToken = {
  text: string;
  isHan: boolean;
  entryId: number | null;
  pinyin: string | null;
  gloss: string | null;
};

export type SegmentCharacter = {
  character: string;
  entryId: number | null;
  pinyin: string | null;
};

const MAX_LENGTH = 600;

/**
 * Longest-match segmentation of a pasted passage using the dictionary index,
 * enriched with headword, pinyin and first gloss for every matched word. Runs of
 * non-Chinese characters are preserved verbatim so punctuation and latin text
 * survive round-tripping.
 */
export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").slice(0, MAX_LENGTH);
  if (!text.trim()) {
    return NextResponse.json({ tokens: [], characters: [], mode: "empty" });
  }

  const tokens: SegmentToken[] = [];
  const runs = text.split(/([^\u3400-\u9fff\uf900-\ufaff]+)/g).filter(Boolean);

  for (const run of runs) {
    if (!isHanText(run)) {
      tokens.push({ text: run, isHan: false, entryId: null, pinyin: null, gloss: null });
      continue;
    }

    for (const segment of segmentChinese(run)) {
      const doc = docForWord(segment);
      tokens.push({
        text: segment,
        isHan: true,
        entryId: doc?.entry.id ?? null,
        pinyin: doc?.pinyinMarks ?? null,
        gloss: doc ? (doc.entry.definition.split("/")[0] ?? null) : null,
      });
    }
  }

  const characters: SegmentCharacter[] = Array.from(
    new Set(Array.from(text).filter((character) => isHanText(character))),
  ).map((character) => {
    const doc = docForWord(character);
    return {
      character,
      entryId: doc?.entry.id ?? null,
      pinyin: doc ? pinyinToMarks(doc.entry.pinyin) : null,
    };
  });

  return NextResponse.json(
    { tokens, characters, mode: detectMode(text) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function docForWord(word: string) {
  const ids = getSearchIndex().byWord.get(word) ?? [];
  return ids.length > 0 ? getDocById(ids[0]) : null;
}
