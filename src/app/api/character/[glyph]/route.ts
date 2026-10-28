import { NextResponse } from "next/server";

import { buildCharacterInfo } from "@/lib/dictionary/character";
import { isGlyphText } from "@/lib/pinyin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ glyph: string }> }) {
  const { glyph } = await context.params;
  const character = decodeURIComponent(glyph);

  if (!isGlyphText(character)) {
    return NextResponse.json({ error: "Not a Chinese character" }, { status: 400 });
  }

  return NextResponse.json(buildCharacterInfo(character), {
    headers: { "Cache-Control": "no-store" },
  });
}
