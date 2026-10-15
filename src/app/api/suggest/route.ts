import { NextResponse } from "next/server";

import { autocomplete } from "@/lib/dictionary/search";
import type { ApiSuggestResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? 8);

  const payload: ApiSuggestResponse = {
    suggestions: autocomplete(query, Number.isFinite(limit) ? Math.min(limit, 20) : 8),
  };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
