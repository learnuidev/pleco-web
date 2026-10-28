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

/** `/dictionary?tab=strokes&view=chart&stroke=8&sort=asc` */
export function browseHref(state: BrowseUrlState): string {
  const params = new URLSearchParams();
  params.set("tab", state.axis);
  if (state.chart) params.set("view", "chart");
  if (state.stroke !== null) params.set("stroke", String(state.stroke));
  if (state.sort !== "number") params.set("sort", state.sort);
  return `/dictionary?${params.toString()}`;
}

/** Reflect the browse state in the URL without navigating. */
export function syncBrowseUrl(state: BrowseUrlState): void {
  if (typeof window === "undefined") return;
  const href = browseHref(state);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== href) window.history.replaceState(null, "", href);
}

/**
 * Leaving the Browse tab should not leave `?tab=…&view=chart` behind on a
 * dictionary URL (the entry path, if any, is kept).
 */
export function clearBrowseUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of BROWSE_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }
}
