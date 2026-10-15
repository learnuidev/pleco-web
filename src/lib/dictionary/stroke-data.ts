/**
 * Stroke outline data (the same data set hanzi-writer renders).
 *
 * `scripts/fetch-stroke-data.mjs` mirrors characters from
 * `hanzi-writer-data` into `public/stroke-data/`, which is what the browser
 * loads first; the client falls back to the public jsDelivr copy for rare
 * characters. This module is the server-side view of that cache: it lets an
 * entry's stroke count/outline render instantly (and offline) in the reader
 * pane, and reports whether a character is available locally at all.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { StrokePreview } from "./types";

const STROKE_DIR = path.join(process.cwd(), "public", "stroke-data");

export const STROKE_CDN_BASE = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1";

const cache = new Map<string, StrokePreview | null>();

function strokeFilePath(character: string): string {
  return path.join(STROKE_DIR, `${character}.json`);
}

export function hasLocalStrokeData(character: string): boolean {
  return existsSync(strokeFilePath(character));
}

export function loadStrokeDataSync(character: string): StrokePreview | null {
  if (cache.has(character)) return cache.get(character) ?? null;

  let value: StrokePreview | null = null;
  const file = strokeFilePath(character);
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as StrokePreview;
      if (Array.isArray(parsed.strokes) && parsed.strokes.length > 0) value = parsed;
    } catch {
      value = null;
    }
  }

  cache.set(character, value);
  return value;
}

/** Reads the manifest written by the fetch script (characters mirrored locally). */
export function localStrokeCharacterCount(): number {
  const manifest = path.join(STROKE_DIR, "manifest.json");
  if (!existsSync(manifest)) return 0;
  try {
    const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { count?: number };
    return parsed.count ?? 0;
  } catch {
    return 0;
  }
}
