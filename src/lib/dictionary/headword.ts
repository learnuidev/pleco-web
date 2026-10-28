/**
 * Headword → CC-CEDICT entry resolution, shared by the `/dictionary/:character`
 * route so a URL can boot the workbench straight into an entry.
 */

import { getDocById, getSearchIndex } from "./search";

/**
 * Best entry for a headword: prefer the line whose simplified form is exactly the
 * query (so 想 opens 想, not a word that merely contains it), otherwise the first
 * line that lists it as a headword — which is how traditional-only forms land on
 * their simplified entry.
 */
export function entryIdForHeadword(raw: string): number | null {
  const query = raw.trim();
  if (!query) return null;

  const ids = getSearchIndex().byWord.get(query) ?? [];
  let fallback: number | null = null;
  for (const id of ids) {
    const doc = getDocById(id);
    if (!doc) continue;
    if (doc.entry.simplified === query) return id;
    if (fallback === null) fallback = id;
  }
  return fallback;
}
