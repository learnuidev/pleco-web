import { NextResponse } from "next/server";

import { search } from "@/lib/dictionary/search";
import type { ApiSearchResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? 60);

  const started = Date.now();
  const result = search(query, Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 60);

  const payload: ApiSearchResponse = {
    query: result.query,
    mode: result.mode,
    segments: result.segments,
    hits: result.hits,
    total: result.total,
    truncated: result.truncated,
    elapsedMs: Date.now() - started,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
