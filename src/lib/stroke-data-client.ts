"use client";

/**
 * Stroke outline data for hanzi-writer.
 *
 * `scripts/fetch-stroke-data.mjs` mirrors a curated set of characters into
 * `public/stroke-data/`, so the common case is a same-origin file read. Anything
 * not mirrored falls back to the public `hanzi-writer-data` copy on jsDelivr,
 * which is exactly where hanzi-writer's own default loader looks.
 */

export type CharacterJson = {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
};

const CDN_BASE = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1";
const LOCAL_BASE = "/stroke-data";

const memory = new Map<string, CharacterJson>();
const inflight = new Map<string, Promise<CharacterJson | null>>();

let localManifest: Set<string> | null = null;
let manifestPromise: Promise<Set<string>> | null = null;

export function isCharacterUnavailable(character: string): boolean {
  return /[\u3000-\u303f\uff00-\uffef]/.test(character);
}

async function loadManifest(): Promise<Set<string>> {
  if (localManifest) return localManifest;
  if (manifestPromise) return manifestPromise;

  manifestPromise = fetch(`${LOCAL_BASE}/manifest.json`)
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { characters?: string[] } | null) => {
      localManifest = new Set(data?.characters ?? []);
      return localManifest;
    })
    .catch(() => {
      localManifest = new Set<string>();
      return localManifest;
    });

  return manifestPromise;
}

async function fetchJson(url: string): Promise<CharacterJson | null> {
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    const data = (await response.json()) as CharacterJson;
    if (!Array.isArray(data.strokes) || data.strokes.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export async function loadCharacterData(character: string): Promise<CharacterJson | null> {
  const cached = memory.get(character);
  if (cached) return cached;

  const pending = inflight.get(character);
  if (pending) return pending;

  const task = (async () => {
    const encoded = encodeURIComponent(character);
    const manifest = await loadManifest();

    const local = manifest.has(character)
      ? await fetchJson(`${LOCAL_BASE}/${encoded}.json`)
      : null;
    const data = local ?? (await fetchJson(`${CDN_BASE}/${encoded}.json`));

    if (data) memory.set(character, data);
    inflight.delete(character);
    return data;
  })();

  inflight.set(character, task);
  return task;
}

/** hanzi-writer `charDataLoader` compatible loader built on the cache above. */
export function charDataLoader(
  character: string,
  onLoad: (data: CharacterJson) => void,
  onError: (error?: unknown) => void,
) {
  loadCharacterData(character)
    .then((data) => {
      if (data) onLoad(data);
      else onError(new Error(`No stroke data for ${character}`));
    })
    .catch(onError);
}

/** Preloads a run of characters (used before an animation starts). */
export async function preloadStrokeData(characters: string[]): Promise<void> {
  await Promise.all(characters.map((character) => loadCharacterData(character)));
}
