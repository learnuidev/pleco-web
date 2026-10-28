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

/** Sub-tabs inside the reader's Characters tab. */
export const READER_SUB_TABS = ["breakdown", "using", "words", "containing"] as const;
export type ReaderSubTabKey = (typeof READER_SUB_TABS)[number];

export function isReaderSubTab(value: string | null | undefined): value is ReaderSubTabKey {
  return typeof value === "string" && (READER_SUB_TABS as readonly string[]).includes(value);
}

/**
 * `/dictionary/想` · `/dictionary/想?tab=strokes` · `…?tab=characters&sub=words`
 *
 * Defaults stay out of the URL: `characters` is the default tab and `breakdown`
 * the default sub-tab (a sub-tab always spells out `tab=characters`, since the
 * sub-tabs only exist there).
 */
export function entryHref(
  glyph: string,
  tab?: ReaderTabKey | null,
  sub?: ReaderSubTabKey | null,
): string {
  const params = new URLSearchParams();
  if (tab === "characters" && sub && sub !== "breakdown") {
    params.set("tab", "characters");
    params.set("sub", sub);
  } else if (tab && tab !== "characters") {
    params.set("tab", tab);
  }
  const query = params.toString();
  return query ? `${characterHref(glyph)}?${query}` : characterHref(glyph);
}

/** Keep the address bar on the entry *and* its open tab / sub-tab. */
export function syncEntryUrl(
  glyph: string,
  tab?: ReaderTabKey | null,
  sub?: ReaderSubTabKey | null,
): void {
  if (typeof window === "undefined" || !glyph) return;
  const href = entryHref(glyph, tab, sub);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== href) window.history.replaceState(null, "", href);
}

/** Query keys owned by the Browse tab. */
export const BROWSE_PARAMS = ["tab", "view", "stroke", "sort"] as const;

export type BrowseAxis = "characters" | "radicals" | "primitives";

export type BrowseUrlState = {
  axis: BrowseAxis;
  /** Chart open (the stroke-distribution panel); it is on by default. */
  chart: boolean;
  /** Stroke filter for the active axis; null = no filter. */
  stroke: number | null;
  /** Characters: most/least common. Radicals: Kangxi number or strokes. Primitives: usage or strokes. */
  sort: "common" | "rare" | "number" | "usage" | "recommended" | "asc" | "desc";
};

export function isBrowseAxis(value: string | null): value is BrowseAxis {
  return value === "characters" || value === "radicals" || value === "primitives";
}

/** `/browse?tab=strokes&view=chart&stroke=8&sort=asc` */
export function browseHref(state: BrowseUrlState): string {
  const params = new URLSearchParams();
  params.set("tab", state.axis);
  // The chart is the default view, so only the plain grid has to say so.
  if (!state.chart) params.set("view", "grid");
  if (state.stroke !== null) params.set("stroke", String(state.stroke));
  if (state.sort !== "common" && state.sort !== "number" && state.sort !== "usage") {
    params.set("sort", state.sort);
  }
  return `/browse?${params.toString()}`;
}

/** Reflect the browse state in the URL without navigating. */
export function syncBrowseUrl(state: BrowseUrlState): void {
  if (typeof window === "undefined") return;
  const href = browseHref(state);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== href) window.history.replaceState(null, "", href);
}
