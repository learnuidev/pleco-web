import { NextResponse } from "next/server";

import { getDictionary } from "@/lib/dictionary/cedict";
import { localStrokeCharacterCount } from "@/lib/dictionary/stroke-data";
import { getSearchIndex } from "@/lib/dictionary/search";
import type { ApiStatusResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Touching the index forces HanziJS + CEDICT to compile, so this endpoint
  // doubles as a warm-up call for the first real search.
  getSearchIndex();
  const { count, version } = getDictionary();
  const strokeCharactersLocal = localStrokeCharacterCount();

  const payload: ApiStatusResponse = {
    cedictEntries: count,
    cedictVersion: version,
    strokeCharactersLocal,
    strokeDataAvailable: strokeCharactersLocal > 0,
    indexReady: true,
  };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
