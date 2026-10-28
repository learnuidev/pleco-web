/**
 * Canonical URLs for the app.
 *
 * Characters are the unit of the dictionary, so `/dictionary/:character` is the
 * permanent address of an entry: shareable, linkable and back-button friendly.
 */
export function characterHref(glyph: string): string {
  return `/dictionary/${encodeURIComponent(glyph)}`;
}

/**
 * Point the address bar at a headword without re-rendering the workbench.
 *
 * Selecting an entry is a state change inside the shell, not a navigation, so
 * `replaceState` keeps the URL honest without paying for a route transition (or
 * throwing away the result list and reader state).
 */
export function syncDictionaryUrl(glyph: string): void {
  if (typeof window === "undefined" || !glyph) return;
  const href = characterHref(glyph);
  if (window.location.pathname !== href) {
    window.history.replaceState(null, "", href);
  }
}
