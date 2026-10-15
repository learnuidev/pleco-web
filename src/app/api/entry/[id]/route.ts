import { NextResponse } from "next/server";

import { buildEntryDetail } from "@/lib/dictionary/entry-detail";
import { getDocById } from "@/lib/dictionary/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Accept either a numeric CEDICT id (`/api/entry/12345`) or a headword
  // (`/api/entry/雪`), which is what the URL bar and deep links use.
  let entryId = Number(id);

  if (!Number.isFinite(entryId)) {
    const { getSearchIndex } = await import("@/lib/dictionary/search");
    const ids = getSearchIndex().byWord.get(decodeURIComponent(id)) ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    entryId = ids[0];
  }

  if (!getDocById(entryId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const detail = buildEntryDetail(entryId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}
