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

/** The reader's tabs, in display order. */
export const READER_TABS = ["strokes", "characters", "examples", "details"] as const;
export type ReaderTabKey = (typeof READER_TABS)[number];

export function isReaderTab(value: string | null | undefined): value is ReaderTabKey {
  return typeof value === "string" && (READER_TABS as readonly string[]).includes(value);
}

/** `/dictionary/想?tab=characters` — the default tab stays out of the URL. */
export function entryHref(glyph: string, tab?: ReaderTabKey | null): string {
  const base = characterHref(glyph);
  return tab && tab !== "strokes" ? `${base}?tab=${tab}` : base;
}

/** Keep the address bar on the entry *and* its open tab. */
export function syncEntryUrl(glyph: string, tab?: ReaderTabKey | null): void {
  if (typeof window === "undefined" || !glyph) return;
  const href = entryHref(glyph, tab);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== href) window.history.replaceState(null, "", href);
}

/** Query keys owned by the Browse tab. */
export const BROWSE_PARAMS = ["tab", "view", "stroke", "sort"] as const;

export type BrowseAxis = "frequency" | "strokes" | "radicals";

export type BrowseUrlState = {
  axis: BrowseAxis;
  /** Chart open (the stroke-distribution panel) rather than the plain grid. */
  chart: boolean;
  /** Stroke filter for the active axis; null = no filter. */
  stroke: number | null;
  /** Radical ordering; the default (Kangxi number) stays out of the URL. */
  sort: "number" | "asc" | "desc";
};

export function isBrowseAxis(value: string | null): value is BrowseAxis {
  return value === "frequency" || value === "strokes" || value === "radicals";
}

/** `/browse?tab=strokes&view=chart&stroke=8&sort=asc` */
export function browseHref(state: BrowseUrlState): string {
  const params = new URLSearchParams();
  params.set("tab", state.axis);
  if (state.chart) params.set("view", "chart");
  if (state.stroke !== null) params.set("stroke", String(state.stroke));
  if (state.sort !== "number") params.set("sort", state.sort);
  return `/browse?${params.toString()}`;
}

/** Reflect the browse state in the URL without navigating. */
export function syncBrowseUrl(state: BrowseUrlState): void {
  if (typeof window === "undefined") return;
  const href = browseHref(state);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== href) window.history.replaceState(null, "", href);
}
