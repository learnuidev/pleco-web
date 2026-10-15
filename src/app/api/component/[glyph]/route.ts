import { NextResponse } from "next/server";

import { componentCharacters, componentExists, radicalMeaning } from "@/lib/hanzi";
import { findRadicalMatch, getRadicals } from "@/lib/dictionary/frequency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ glyph: string }> }) {
  const { glyph } = await context.params;
  const component = decodeURIComponent(glyph);

  if (!componentExists(component)) {
    return NextResponse.json({ error: "Unknown component" }, { status: 404 });
  }

  const characters = componentCharacters(component);
  const radical = findRadicalMatch([component]);

  return NextResponse.json(
    {
      glyph: component,
      exists: true,
      isRadical: Boolean(radical),
      radicalNumber: radical?.number ?? null,
      radicalMeaning: radical?.meaning ?? radicalMeaning(component),
      allRadicals: radical ? getRadicals().length : undefined,
      count: characters.length,
      characters,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
