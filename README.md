# Pleco Web

A desktop-class Chinese dictionary and study workspace for the browser — the
Pleco experience rebuilt as a three-pane macOS-style window: search on the left,
the entry reader on the right, and stroke order, character decomposition and
phonetic analysis one click away.

All dictionary content is served locally from the [`hanzi`](https://www.npmjs.com/package/hanzi)
(HanziJS) package; stroke animation uses [`hanzi-writer`](https://www.npmjs.com/package/hanzi-writer)
with the same data set Pleco-style apps use.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← →   ⌘K  search Chinese, pinyin, or English…            简 繁   125,049     │
├──────────┬──────────────────────────┬────────────────────────────────────────┤
│ Pleco    │ 25 results               │        学   xué   rank #66             │
│ ●●●      │ 学  xué  #66             │        1 to learn   3 to imitate       │
│          │ 血  xuè  #658            │  ─────────────────────────────────────  │
│ Search   │ 雪  xuě  #1003           │  Strokes  Characters  Examples  Details│
│ Text     │ 削  xuē  #1794           │  ┌──────────────────────────────────┐  │
│ Browse   │ 穴  xué  #1940           │  │  Animate · Step · Quiz  0.5× 2×  │  │
│ Saved    │ …                        │  │        ┌──────────┐              │  │
│          │                          │  │        │    学    │  8 strokes    │  │
│ RECENT   │                          │  │        └──────────┘              │  │
└──────────┴──────────────────────────┴────────────────────────────────────────┘
```

## Features

**Dictionary**

- CC-CEDICT search in three directions at once: Chinese characters, pinyin
  (with tone marks, tone numbers, or neither), and English.
- Chinese input is **longest-match segmented** against the dictionary, so pasting
  a sentence finds the words inside it rather than nothing at all.
- Latin input is searched against both the pinyin index and the English gloss
  index, then blended — `xue` finds 学 / 雪 / 血 and `snow` finds 雪 / 白雪 / 积雪.
- Single characters fall back to "words containing this character" so partial
  knowledge still leads somewhere.
- Traditional ⇄ simplified toggle, multiple-reading variants (`的` de5/di2/di4),
  Jun Da frequency ranks, and clickable Chinese runs inside definitions
  (including `CL:` classifier references).

**Strokes** (`hanzi-writer`)

- **Animate** — watch characters drawn stroke by stroke, with speed control.
- **Step** — advance one stroke at a time, with a live `n / total` readout.
- **Quiz** — write each character with the pointer; graded live with
  mistake counting, hints after two misses, and a completion flash.
- Stroke outlines are mirrored into `public/stroke-data/` at build time (400
  characters by default) so the common case works offline; rare characters fall
  back to the public `hanzi-writer-data` CDN.
- 米字格 practice grid behind quiz canvases.

**Characters** (HanziJS)

- All four decomposition levels: *once*, *radical*, *graphical*, *primitive*.
- Components with radical meanings, Kangxi radical numbers, primitive flags, and
  "used in N characters" counts.
- Phonetic regularity analysis — which components hint at the reading, and how
  closely (exact tone / same syllable / shared initial / shared final).
- Frequency detail with a percentile bar, plus common two-character words built
  from the character.

**Text reader**

- Paste a passage → longest-match segmentation with pinyin under each word, a
  hover gloss, and a per-character grid with readings.
- Passages you analyse are remembered in History as text sessions; clicking one
  reopens the text reader with that passage restored.

**Browse**

Two inventories, one toolbar language (Radicals opens first):

- **Radicals** — the classic 214-radical Kangxi inventory. Every form is its own
  browsable entry: the canonical glyph plus each variant (氵 氺, 忄, 扌, ⺮ ケ,
  飠 食 …), each with its own stroke count, meaning, pinyin and usage, so stroke
  filters and the distribution chart count variants independently. Sortable by
  Kangxi number or by stroke count either way.
- **Characters** — the frequency-ranked corpus, filterable by stroke count,
  ordered most-common or least-common first, with #N, pinyin and gloss on each
  tile.
- Both axes open a gradient-filled stroke-distribution chart (recharts) whose
  bars double as filters, and both keep their state in the URL
  (`?tab=characters&view=grid&stroke=7&sort=rare`, and `view=chart` is the default).
- Every character and radical is a link into its own `/dictionary/:character`
  page.

**Learning**

- Mark a character or radical as learned from the reader.
- `/learning` lists everything learned, plus the characters those radicals
  **fully unlock** (every radical learned) and **partly unlock** (some learned —
  with the percentage and the radicals still missing, each linking straight to
  the radical you need to learn).

**Saved words**

- Saved in the browser, exported as tab-separated (Anki / Pleco friendly), CSV,
  Markdown, or plain text.

**Desktop feel**

- Resizable splitter (drag or arrow keys) between the result list and reader.
- Keyboard: `⌘K` focus search, `↑`/`↓` walk results, `[` / `]` walk history,
  `Esc` dismiss suggestions then clear the query.
- Light/dark appearance, translucent chrome, hairline separators, spring
  animations (framer-motion), and persisted history + saved words.

## Getting started

```bash
npm install
npm run dev          # http://localhost:4310
```

On the first request the server compiles HanziJS' data files (~1 s, once per
process); every search after that is single-digit milliseconds.

### Routes

| URL | What it serves |
| --- | --- |
| `/` | Redirects to `/dictionary` |
| `/dictionary` | The workbench, nothing selected |
| `/dictionary/:character` | That entry in the reader |
| `/dictionary/想?tab=characters` | The same entry with a reader tab open |
| `/dictionary/木?tab=characters&sub=using` | The Characters tab's "Characters using 木" sub-tab |
| `/browse` | Characters (by frequency, filterable by strokes) and the radical inventory |
| `/browse?tab=characters&view=grid&stroke=8&sort=rare` | Browse, with axis, chart, filter and sort in the URL |
| `/text` | The text reader |
| `/saved` | Saved words |
| `/history` | Everything opened in the reader, grouped into blocks (newest first) |
| `/learning` | Learned characters/radicals and the characters they unlock |

Every in-app route shares one shell (title bar, sidebar, status bar) from
`(workbench)/layout.tsx`, so switching routes only swaps the content area and the
search state survives the move.

Browse (on its own `/browse` route) keeps its whole state in the query string —
`tab` (`characters` / `radicals`), `view` (`grid` when the stroke-distribution
panel is closed; it is open by default), `stroke` (the active stroke filter) and `sort` (`common` /
`rare` for characters, `asc` / `desc` for radicals) — so a chart or a filtered
grid is a link you can bookmark or paste. Both axes chart their stroke
distribution, and the bars act as filters.

A radical's **Characters using** sub-tab groups its family into **Popular** (Jun Da
rank under 5,000) and **Less popular** (rank 5,000+ or unranked), each row showing
the glyph, pinyin, gloss and rank.

The dictionary is one layout — sidebar, search, result list and reader — and the
address bar simply follows what the reader shows. Selecting a result, a Recent
item, a saved word or a related entry rewrites the URL with `replaceState` (no
reload), so every entry is linkable and shareable while the shell keeps its
state. The reader's tabs are addressable too: `?tab=characters` opens straight
into decomposition, and the Characters tab is itself sub-tabbed — **Breakdown**
(the decomposition cards), **Characters using** this radical, **Common words**,
and **Words containing** it — with the choice carried as `&sub=words`. Anything
that is a character (a browse card, a radical tile, one of those lists) navigates
to its `/dictionary/:character` URL.

```bash
npm run build && npm start   # production build on :4310
npm run typecheck            # tsc --noEmit
npm run fetch:strokes        # mirror more stroke data (see below)
```

### Stroke data

`public/stroke-data/` ships 400 mirrored characters (HSK 1–3 plus the most
common radicals). To mirror a different set:

```bash
node scripts/fetch-stroke-data.mjs 你好世界   # explicit characters
node scripts/fetch-stroke-data.mjs --all      # every character with data (~9k)
```

The script rewrites `public/stroke-data/manifest.json`, which is what the client
checks before deciding between the local file and the CDN.

## Architecture

```
src/
  app/
    api/            search · entry · suggest · segment · browse · character · component · status
    (workbench)/    layout with the shell; dictionary/, browse/, text/ and saved/ routes
    globals.css     design tokens (Apple-flavoured materials, elevation, dark mode)
  components/
    workbench/      shell, sidebar, splitter, reducer-backed state
    search/         search field with autocomplete, result list
    entry/          hero, tabs, character cards, example buckets
    stroke/         hanzi-writer wrapper, stroke-order panel
    text/ browse/ saved/
  lib/
    dictionary/     CEDICT parsing, search index, entry/character assembly
    hanzi.ts        HanziJS bridge (server only)
    pinyin.ts       numbered pinyin → tone marks (server)
    pinyin-client.ts  the same helpers for the browser
```

### Why CEDICT is parsed directly

HanziJS compiles CC-CEDICT into two plain object maps keyed by headword, which
is ideal for exact lookups but cannot answer "which entries contain this
character", "which glosses start with *snow*", or "which pinyin reads *xue*".
So the same shipped dictionary text is parsed once into a flat array that is
indexed four ways (`byWord`, `pinyinIndex`, `glossIndex`, `charIndex`), while
**every linguistic operation still goes through HanziJS** — decomposition,
phonetic regularity, component usage, corpus-ranked examples, segmentation.

### Server notes

- `hanzi` is listed in `serverExternalPackages` and aliased to one absolute path
  in `next.config.ts`. Without that, every route handler would compile its own
  ~15 MB copy of the dictionaries.
- Expensive HanziJS calls (`getExamples`, `getCharactersWithComponent`,
  decomposition trees, phonetic analysis) and assembled entry details are
  memoised on `globalThis` so route handlers share the caches.

## Data sources and licensing

| Data | Source | Licence |
| --- | --- | --- |
| Dictionary | CC-CEDICT via `hanzi` | CC BY-SA 4.0 |
| Decomposition | CJK decomposition data via `hanzi` | see HanziJS |
| Frequency | Jun Da + Leiden corpora via `hanzi` | non-commercial; do not resell |
| Stroke outlines | `hanzi-writer-data` | MIT |

HanziJS itself is MIT; its bundled data carries the licences above. This project
is a personal, non-commercial rebuild and ships no data of its own.
